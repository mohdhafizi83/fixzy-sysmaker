/**
 * Web server + IPC-over-HTTP shim (Phase 5.3).
 *
 * Serves the existing renderer as static files and exposes every registered
 * IPC handler as POST /ipc/<channel>. Push events (overlay, custom dialogs)
 * stream to the browser via Server-Sent Events at GET /events.
 *
 * Security (Phase 5.6): binds 127.0.0.1 by default. --host 0.0.0.0 is
 * refused unless FSM_ALLOW_REMOTE=1.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openStore } = require('./store');
const { validateOutputPath } = require('./pathGuard');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

/**
 * Extract method -> {channel, mode} from preload.js so the web shim mirrors
 * the exact Electron API surface (single source of truth).
 */
function extractApiMap(preloadPath) {
    const src = fs.readFileSync(preloadPath, 'utf8');
    const map = {};
    const re = /(\w+)\s*:\s*(?:\([^)]*\)\s*=>\s*)?ipcRenderer\.(invoke|send)\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        map[m[1]] = { channel: m[3], mode: m[2] };
    }
    return map;
}

/**
 * IPC registry shim compatible with the real ipcMain interface used by
 * registerIpcHandlers: .handle / .on / .once + invoke(name, ...args).
 */
function createIpcShim() {
    const handles = new Map();
    const listeners = new Map(); // event -> [{fn, once}]
    return {
        handle(name, fn) {
            if (handles.has(name)) throw new Error(`Duplicate IPC handle: ${name}`);
            handles.set(name, fn);
        },
        on(name, fn) {
            if (!listeners.has(name)) listeners.set(name, []);
            listeners.get(name).push({ fn, once: false });
        },
        once(name, fn) {
            if (!listeners.has(name)) listeners.set(name, []);
            listeners.get(name).push({ fn, once: true });
        },
        async invoke(name, ...args) {
            const fn = handles.get(name);
            if (!fn) throw new Error(`No IPC handler: ${name}`);
            return fn({ sender: null }, ...args);
        },
        emit(name, ...args) {
            const list = listeners.get(name) || [];
            for (const entry of list.slice()) {
                if (entry.once) {
                    const idx = list.indexOf(entry);
                    if (idx !== -1) list.splice(idx, 1);
                }
                entry.fn({ sender: null }, ...args);
            }
        },
        hasHandler: (name) => handles.has(name),
        hasListener: (name) => (listeners.get(name) || []).length > 0,
        handlerNames: () => [...handles.keys()],
    };
}

function createWebServer(opts = {}) {
    const host = opts.host || '127.0.0.1';
    const port = opts.port || 7788;
    const srcDir = opts.srcDir || path.join(__dirname, '..');
    const preloadPath = opts.preloadPath || path.join(srcDir, 'preload.js');

    const db = opts.db || openStore(opts.dbPath);
    const ipc = createIpcShim();
    const sseClients = new Set();

    // Fake BrowserWindow: webContents.send broadcasts to all SSE clients.
    const webWindow = {
        webContents: {
            send: (channel, data) => {
                const payload = `event: ipc\ndata: ${JSON.stringify({ channel, data })}\n\n`;
                for (const res of sseClients) {
                    try { res.write(payload); } catch { sseClients.delete(res); }
                }
            },
        },
    };

    const registerIpcHandlers = require('../handlers/register');
    registerIpcHandlers({
        ipcMain: ipc,
        db,
        getPath: (name) => {
            if (name === 'userData') return opts.userData || path.join(os.homedir(), '.fizisysmaker');
            return os.homedir();
        },
        getWindow: () => webWindow,
        dialog: {
            showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
            showMessageBox: async () => ({ response: 0 }),
        },
        shell: { openExternal: async (url) => console.log('[web] open-url requested:', url) },
        isPackaged: false,
        enforceOutputRoots: true,
        onQuit: (fn) => {
            process.on('SIGINT', fn);
            process.on('SIGTERM', fn);
        },
    });

    const apiMap = extractApiMap(preloadPath);

    function sendJson(res, code, obj) {
        const body = JSON.stringify(obj);
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(body);
    }

    function readBody(req) {
        return new Promise((resolve, reject) => {
            let data = '';
            req.on('data', (c) => {
                data += c;
                if (data.length > 50 * 1024 * 1024) {
                    reject(new Error('body too large'));
                    req.destroy();
                }
            });
            req.on('end', () => resolve(data));
            req.on('error', reject);
        });
    }

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

        // SSE event stream
        if (req.method === 'GET' && url.pathname === '/events') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            });
            res.write(': connected\n\n');
            sseClients.add(res);
            req.on('close', () => sseClients.delete(res));
            return;
        }

        // IPC bridge
        if (req.method === 'POST' && url.pathname.startsWith('/ipc/')) {
            const channel = decodeURIComponent(url.pathname.slice('/ipc/'.length));
            const hasHandle = ipc.hasHandler(channel);
            const hasListener = ipc.hasListener(channel);
            if (!hasHandle && !hasListener) {
                return sendJson(res, 404, { error: `unknown channel: ${channel}` });
            }
            let args = [];
            try {
                const raw = await readBody(req);
                args = raw ? JSON.parse(raw) : [];
            } catch (e) {
                return sendJson(res, 400, { error: 'invalid JSON body: ' + e.message });
            }
            if (!Array.isArray(args)) args = [args];
            try {
                if (hasHandle) {
                    const result = await ipc.invoke(channel, ...args);
                    return sendJson(res, 200, { ok: true, result });
                }
                // send-style channel (ipcMain.on/once): fire, no return value
                ipc.emit(channel, ...args);
                return sendJson(res, 200, { ok: true });
            } catch (e) {
                return sendJson(res, 200, { ok: false, error: e.message });
            }
        }

        // API map introspection (used by the generated shim)
        if (req.method === 'GET' && url.pathname === '/api-map.json') {
            return sendJson(res, 200, apiMap);
        }

        // Static renderer files
        if (req.method === 'GET') {
            // Web shim served from its real location
            if (url.pathname === '/core/web-shim.js') {
                res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
                fs.createReadStream(path.join(__dirname, 'web-shim.js')).pipe(res);
                return;
            }
            let rel = url.pathname === '/' ? '/index.html' : url.pathname;
            const filePath = path.join(srcDir, path.normalize(rel));
            // Containment: never serve outside srcDir
            if (!filePath.startsWith(srcDir + path.sep) && filePath !== srcDir) {
                return sendJson(res, 403, { error: 'forbidden' });
            }
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const ext = path.extname(filePath);
                if (ext === '.html') {
                    // Inject the IPC shim before any renderer script runs.
                    let html = fs.readFileSync(filePath, 'utf8');
                    const shimTag = '<script src="/core/web-shim.js"></script>';
                    if (html.includes('<head>')) {
                        html = html.replace('<head>', '<head>\n    ' + shimTag);
                    } else {
                        html = shimTag + html;
                    }
                    res.writeHead(200, { 'Content-Type': MIME[ext] });
                    res.end(html);
                    return;
                }
                res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
                fs.createReadStream(filePath).pipe(res);
                return;
            }
            return sendJson(res, 404, { error: 'not found' });
        }

        sendJson(res, 405, { error: 'method not allowed' });
    });

    return { server, ipc, db, apiMap, host, port };
}

module.exports = { createWebServer, createIpcShim, extractApiMap };
