'use strict';
/**
 * MCP server (Fixzy SysMaker) — stdio transport.
 *
 * Exposes the tool registry (src/mcp/tools.js) over the Model Context
 * Protocol so external AI hosts (Claude Desktop, Cursor, etc.) can drive
 * the same core pipeline the GUI uses.
 *
 * Transport: stdio JSON-RPC. CRITICAL: stdout is protocol-exclusive.
 * The legacy handler registry (register.js) and generators log freely via
 * console.log — in Electron/GUI that goes to the dev console, but here a
 * stray log would corrupt the JSON-RPC stream. So before connecting we
 * redirect console.log/info/warn/debug (and raw process.stdout.write) to
 * stderr. Errors keep their messages; nothing is swallowed.
 *
 * Gating (security-by-default):
 *   - read tools: always on
 *   - write tools: FSM_MCP_ALLOW_WRITE=1 (or opts.allowWrite)
 *   - generate tool: FSM_MCP_ALLOW_GENERATE=1 (or opts.allowGenerate)
 *   - output paths: always through pathGuard (FSM_OUTPUT_ROOTS)
 *   - deploy/update/composer/preview: never exposed
 */

const path = require('path');

/**
 * Redirect console output away from stdout so the MCP JSON-RPC stream on
 * stdout stays pure. Idempotent.
 * @returns {void}
 */
function redirectConsoleToStderr() {
    const write = process.stderr.write.bind(process.stderr);
    const tag = (level) => (...args) => {
        write(`[fixzy-mcp ${level}] ${args.map((a) => (typeof a === 'string' ? a : safeInspect(a))).join(' ')}\n`);
    };
    console.log = tag('log');
    console.info = tag('info');
    console.warn = tag('warn');
    console.debug = tag('debug');
    // Belt-and-braces: anything writing raw to stdout (third-party libs)
    // also lands on stderr. console.error is left alone (already stderr).
    // NOTE: the MCP transport must be constructed with the ORIGINAL stdout
    // write (see getOriginalStdoutWrite) — StdioServerTransport captures
    // process.stdout as a constructor default, so a late override of the
    // shared object property would hijack protocol frames too.
    process.stdout.write = (chunk, enc, cb) => {
        write(typeof chunk === 'string' ? chunk : Buffer.from(chunk));
        if (typeof enc === 'function') enc();
        else if (typeof cb === 'function') cb();
        return true;
    };
}

/**
 * Capture the pristine stdout write at module load, BEFORE
 * redirectConsoleToStderr() replaces process.stdout.write.
 *
 * Function references (including .bind() results) are immune to later
 * property replacement: the bound copy keeps calling the ORIGINAL native
 * write even after process.stdout.write points at the stderr redirect.
 * This is what keeps MCP protocol frames on real stdout.
 */
const PRISTINE_STDOUT_WRITE = process.stdout.write.bind(process.stdout);
function getOriginalStdoutWrite() {
    return PRISTINE_STDOUT_WRITE;
}

function safeInspect(v) {
    try { return require('util').inspect(v, { depth: 4, colors: false }); }
    catch { return String(v); }
}

/**
 * Create the MCP server instance plus its tool list (filtered by gating).
 * Does NOT connect a transport — callers decide (stdio for CLI, in-memory
 * for tests).
 *
 * @param {object} opts
 * @param {import('better-sqlite3').Database} opts.db
 * @param {(name:string, ...args:any[])=>Promise<any>} opts.callHandler
 * @param {boolean} [opts.allowWrite]
 * @param {boolean} [opts.allowGenerate]
 * @returns {Promise<{server: import('@modelcontextprotocol/sdk/server/index.js').Server, tools: Array}>}
 */
async function createMcpServer(opts) {
    const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
    const {
        ListToolsRequestSchema,
        CallToolRequestSchema,
        ListResourcesRequestSchema,
        ReadResourceRequestSchema,
    } = require('@modelcontextprotocol/sdk/types.js');
    const { buildToolRegistry } = require('./tools');

    const allTools = buildToolRegistry({
        db: opts.db,
        callHandler: opts.callHandler,
        allowWrite: !!opts.allowWrite,
        allowGenerate: !!opts.allowGenerate,
    });
    const visibleTools = allTools.filter((t) =>
        !t.gate || (t.gate === 'write' && opts.allowWrite) || (t.gate === 'generate' && opts.allowGenerate));

    const server = new Server(
        { name: 'fixzy-sysmaker', version: require('../../package.json').version },
        {
            capabilities: {
                tools: {},
                resources: {},
            },
        }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: visibleTools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
        })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const name = request.params && request.params.name;
        const tool = visibleTools.find((t) => t.name === name);
        if (!tool) {
            return {
                content: [{ type: 'text', text: `Unknown or disabled tool: ${name}` }],
                isError: true,
            };
        }
        try {
            const result = await tool.handler(request.params.arguments || {});
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Tool "${name}" failed: ${e.message}` }],
                isError: true,
            };
        }
    });

    // ── Static + project resources ───────────────────────────────────────
    const RESOURCES = [
        {
            uri: 'fixzy://capabilities',
            name: 'Fixzy SysMaker capabilities',
            description: 'Stacks, engines, themes, widgets, gating status (JSON).',
            mimeType: 'application/json',
            read: async () => {
                const capsTool = allTools.find((t) => t.name === 'fixzy_capabilities');
                const caps = await capsTool.handler({});
                // Resource contents.text must be a string — serialize the JSON.
                return JSON.stringify(caps, null, 2);
            },
        },
        {
            uri: 'fixzy://docs/ir-mapping',
            name: 'IR mapping contract',
            description: 'How the neutral IR maps to Laravel + Filament constructs.',
            mimeType: 'text/markdown',
            read: async () =>
                require('fs').readFileSync(path.join(__dirname, '..', '..', 'docs', 'IR_MAPPING.md'), 'utf8'),
        },
        {
            uri: 'fixzy://docs/faq',
            name: 'FAQ',
            description: 'Frequently asked questions about generated apps.',
            mimeType: 'text/markdown',
            read: async () =>
                require('fs').readFileSync(path.join(__dirname, '..', '..', 'docs', 'FAQ.md'), 'utf8'),
        },
    ];

    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: RESOURCES.map(({ uri, name, description, mimeType }) => ({ uri, name, description, mimeType })),
    }));

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const uri = request.params && request.params.uri;
        const res = RESOURCES.find((r) => r.uri === uri);
        if (!res) throw new Error(`Unknown resource: ${uri}`);
        const content = await res.read();
        return { contents: [{ uri, mimeType: res.mimeType, text: content }] };
    });

    return { server, tools: visibleTools };
}

/**
 * Boot the MCP server on stdio against the live Fixzy store.
 * @param {{allowWrite?:boolean, allowGenerate?:boolean, dataDir?:string}} [opts]
 * @returns {Promise<{server:any, tools:Array}>}
 */
async function startStdioMcp(opts = {}) {
    redirectConsoleToStderr();

    const os = require('os');
    const fs = require('fs');
    const { openStore } = require('../core/store');
    const dataDir = opts.dataDir || process.env.FSM_DATA_DIR || path.join(os.homedir(), '.fixzy');
    fs.mkdirSync(dataDir, { recursive: true });
    const db = openStore(path.join(dataDir, 'Fixzy SysMaker.db'));

    // Same handler-registry bootstrap the headless CLI uses: register all
    // IPC handlers against a shim, then invoke them by name.
    const handlers = new Map();
    const shim = {
        handle: (name, fn) => handlers.set(name, fn),
        on: () => {},
        once: () => {},
    };
    const registerIpcHandlers = require('../handlers/register');
    registerIpcHandlers({
        ipcMain: shim,
        db,
        getPath: () => dataDir,
        getWindow: () => null,
        dialog: {
            showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
            showMessageBox: async () => ({ response: 0 }),
        },
        shell: { openExternal: async () => {} },
        isPackaged: false,
        enforceOutputRoots: true,
        onQuit: () => {},
    });
    const callHandler = async (name, ...args) => {
        const fn = handlers.get(name);
        if (!fn) throw new Error(`No such handler: ${name}`);
        return fn(null, ...args);
    };

    const allowWrite = opts.allowWrite !== undefined
        ? !!opts.allowWrite
        : process.env.FSM_MCP_ALLOW_WRITE === '1';
    const allowGenerate = opts.allowGenerate !== undefined
        ? !!opts.allowGenerate
        : process.env.FSM_MCP_ALLOW_GENERATE === '1';

    const { server, tools } = await createMcpServer({ db, callHandler, allowWrite, allowGenerate });

    const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
    // Minimal stream facade that always writes through to the ORIGINAL
    // stdout (captured at module load), bypassing the console redirect.
    // The transport only needs .write() and .once('drain').
    const protocolStream = {
        write: (chunk, enc, cb) => PRISTINE_STDOUT_WRITE(chunk, enc, cb),
        once: (...a) => process.stdout.once(...a),
        on: (...a) => process.stdout.on(...a),
    };
    const transport = new StdioServerTransport(process.stdin, protocolStream);
    await server.connect(transport);
    if (process.env.FSM_MCP_TRACE === '1') {
        const origOnMessage = transport.onmessage;
        transport.onmessage = (m) => { process.stderr.write(`[trace] recv ${JSON.stringify(m).slice(0, 120)}\n`); if (origOnMessage) origOnMessage.call(transport, m); };
        const origSend = transport.send.bind(transport);
        transport.send = (m) => { process.stderr.write(`[trace] send ${JSON.stringify(m).slice(0, 120)}\n`); return origSend(m); };
    }

    process.stderr.write(
        `[fixzy-mcp] ready — ${tools.length} tool(s) exposed ` +
        `(write=${allowWrite ? 'on' : 'off'}, generate=${allowGenerate ? 'on' : 'off'})\n`);

    const cleanup = () => { try { db.close(); } catch { /* already closed */ } };
    process.on('exit', cleanup);
    ['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => { cleanup(); process.exit(0); }));

    return { server, tools };
}

module.exports = { createMcpServer, startStdioMcp, redirectConsoleToStderr };
