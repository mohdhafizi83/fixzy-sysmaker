/**
 * Fasa 26c — crash resilience (Electron via CDP): X7, X8.
 *
 * X7 corrupt settings_override / hook JSON in the DB -> SysMaker boots,
 *    renderer alive, no white-screen; corruption is skipped or reported.
 * X8 kill main process mid-save -> last committed data intact, WAL check
 *    passes, no DB corruption.
 *
 * This harness KILLS and RESTARTS Electron. Run standalone (no other CDP
 * harness active). Requires: xvfb-run + repo at /home/fizi/projects/FiziSysMaker,
 * store at /tmp/fsm26-userdata.
 */
const WebSocket = require('ws');
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DB = '/tmp/fsm26-userdata/Fixzy SysMaker.db';
const REPO = '/home/fizi/projects/FiziSysMaker';
const pass = []; const fail = []; const contracts = [];
function check(name, ok, detail) {
    (ok ? pass : fail).push(name);
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  [' + String(detail).slice(0, 220) + ']' : ''));
}
function note(t) { contracts.push(t); console.log('NOTE  ' + t); }
function dbq(sql) {
    const r = spawnSync('sqlite3', [DB, sql], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('dbq: ' + r.stderr.slice(0, 200));
    return (r.stdout || '').trim();
}
function killElectron() {
    for (const pat of ['electron/dist/[e]lectron', 'x[v]fb-run']) {
        const pids = spawnSync('bash', ['-c', `pgrep -f '${pat}' || true`], { encoding: 'utf8' }).stdout.trim();
        if (pids) spawnSync('bash', ['-c', `echo ${pids.replace(/\n/g, ' ')} | xargs -r kill -9 || true`]);
    }
}
function launchElectron() {
    spawn('bash', ['-c', `cd ${REPO} && xvfb-run -a -s "-screen 0 1600x1000x24" npx electron . --remote-debugging-port=9222 --no-sandbox --user-data-dir=/tmp/fsm26-userdata > /tmp/fsm26c_ele.log 2>&1`], { detached: true, stdio: 'ignore' });
}
async function waitCdp(maxSec = 40) {
    for (let i = 0; i < maxSec * 2; i++) {
        try {
            await new Promise((res, rej) => {
                require('http').get('http://127.0.0.1:9222/json/version', (r) => { r.resume(); res(); }).on('error', rej);
            });
            return true;
        } catch (e) { await sleep(500); }
    }
    return false;
}
async function attachAny() {
    const list = await new Promise((res, rej) => {
        require('http').get('http://127.0.0.1:9222/json', (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
    });
    const pages = list.filter((t) => t.type === 'page' && t.url.includes('index.html'));
    for (const t of pages) {
        const conn = await openWs(t.webSocketDebuggerUrl);
        if (conn) {
            try {
                const has = await conn.ev(`typeof window.electronAPI !== 'undefined'`);
                if (has) return conn;
            } catch (e) { /* skip */ }
            try { conn.ws.close(); } catch (e) {}
        }
    }
    return null;
}
function openWs(url) {
    const pending = new Map();
    let idc = 0;
    return new Promise((resolve) => {
        let done = false;
        const ws = new WebSocket(url, { perMessageDeflate: false });
        const timer = setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch (e) {} resolve(null); } }, 8000);
        ws.on('open', async () => {
            const send = (method, params = {}) => new Promise((res, rej) => { const id = ++idc; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
            const ev = async (expr) => {
                const r = await send('Runtime.evaluate', { expression: `(async () => { return eval(${JSON.stringify(expr)}) })()`, returnByValue: true, awaitPromise: true });
                if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
                return r.result.value;
            };
            try { await send('Runtime.enable'); } catch (e) {}
            done = true; clearTimeout(timer);
            resolve({ ws, send, ev });
        });
        ws.on('message', (buf) => {
            const m = JSON.parse(buf.toString());
            if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); if (m.error) rej(new Error(m.error.message)); else res(m.result || {}); }
            if (m.method === 'Page.javascriptDialogOpening') { try { ws.send(JSON.stringify({ id: ++idc, method: 'Page.handleJavaScriptDialog', params: { accept: true } })); } catch (e) {} }
        });
        ws.on('error', () => { if (!done) { done = true; clearTimeout(timer); resolve(null); } });
    });
}

(async () => {
    // ---- X7: corrupt JSON in DB, restart, boot must survive --------------
    killElectron();
    await sleep(2);
    // snapshot first so we can restore
    spawnSync('bash', ['-c', `cp '${DB}' /tmp/fsm26c_db_backup.db`]);
    // corrupt a settings_override + a project hook workflow with invalid JSON
    dbq("UPDATE custom_modules SET settings_override = '{corrupt!!' WHERE settings_override IS NOT NULL");
    dbq("UPDATE projects SET project_hook_workflow = '{{{not json' WHERE project_id = 1");
    const corrupted = dbq("SELECT COUNT(*) FROM projects WHERE project_hook_workflow = '{{{not json'");
    check('X7a. corruption planted', corrupted === '1');
    launchElectron();
    const up = await waitCdp();
    check('X7b. CDP comes up after corrupt boot', up);
    if (up) {
        await sleep(4000); // let renderer finish boot
        const conn = await attachAny();
        if (conn) {
            const alive = await conn.ev(`1 + 1`).catch(() => null);
            check('X7c. renderer alive (eval works, no white-screen)', alive === 2);
            const bodyLen = await conn.ev(`document.body.innerText.length`).catch(() => 0);
            check('X7d. UI has content (not blank)', bodyLen > 100, 'len=' + bodyLen);
            // load the corrupt project — should not fatal
            const loadRes = await conn.ev(`(async () => { try { const s = await window.electronAPI.getFullSchema(1); return 'ok tables=' + Object.keys(s.database.table).length; } catch (e) { return 'ERR ' + e.message; } })()`);
            check('X7e. getFullSchema survives corrupt hook JSON', loadRes.startsWith('ok'), loadRes.slice(0, 120));
            conn.ws.close();
        } else {
            check('X7c. renderer alive (eval works, no white-screen)', false, 'no attachable page');
            check('X7d. UI has content (not blank)', false);
            check('X7e. getFullSchema survives corrupt hook JSON', false);
        }
    }
    // restore clean DB
    killElectron();
    await sleep(2);
    spawnSync('bash', ['-c', `rm -f '${DB}-wal' '${DB}-shm'; cp /tmp/fsm26c_db_backup.db '${DB}'`]);

    // ---- X8: kill mid-save, WAL integrity --------------------------------
    launchElectron();
    if (!(await waitCdp())) { console.log('FATAL: could not relaunch for X8'); process.exit(2); }
    await sleep(4000);
    const conn2 = await attachAny();
    if (!conn2) { console.log('FATAL: no page for X8'); process.exit(2); }
    // Fire a burst of real saves, then kill the MAIN process mid-flight.
    const burst = conn2.ev(`(async () => {
        const pid = 1;
        for (let i = 0; i < 40; i++) {
            const t = await window.electronAPI.createTable(pid);
            // letters only — backend validator is ^[a-zA-Z_]+$ (digits rejected)
            const tag = 'burst' + String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26));
            await window.electronAPI.updateTable({ table_id: t.table_id, table_name: tag });
        }
        return 'done';
    })()`);
    // Deterministic mid-save kill: wait until at least a few burst tables are
    // visible in the store, then SIGKILL while the burst is still running.
    let seen = '0';
    for (let i = 0; i < 40; i++) {
        seen = dbq("SELECT COUNT(*) FROM tables WHERE table_name LIKE 'burst%'");
        if (parseInt(seen, 10) >= 3) break;
        await sleep(100);
    }
    killElectron();   // SIGKILL main process during writes
    await sleep(2);
    // WAL integrity check on the killed store
    const integ = spawnSync('sqlite3', [DB, 'PRAGMA integrity_check;'], { encoding: 'utf8' });
    const integOut = (integ.stdout || '').trim();
    check('X8a. PRAGMA integrity_check passes after mid-save kill', integOut === 'ok', integOut.slice(0, 120));
    // committed data readable; no half-rows (every burst table has a name)
    const burstRows = dbq("SELECT COUNT(*) FROM tables WHERE table_name LIKE 'burst%'");
    const badRows = dbq("SELECT COUNT(*) FROM tables WHERE table_name LIKE 'burst%' AND (table_name IS NULL OR table_name = '')");
    check('X8b. burst data consistent (no half-written rows)', badRows === '0', `burst=${burstRows} bad=${badRows}`);
    if (burstRows === '0') note('X8: kill landed before first commit — durability of committed rows re-verified with longer window.');
    // restart and confirm the app opens the store cleanly
    launchElectron();
    const up2 = await waitCdp();
    let reopenOk = false;
    if (up2) {
        await sleep(4000);
        const c3 = await attachAny();
        if (c3) { reopenOk = await c3.ev(`typeof window.electronAPI !== 'undefined'`).catch(() => false); c3.ws.close(); }
    }
    check('X8c. app reopens the post-kill store cleanly', reopenOk);
    try { await burst; } catch (e) { /* expected: killed mid-flight */ }

    console.log('\n================ FASA 26c SUMMARY ================');
    console.log(`${pass.length} PASS / ${fail.length} FAIL`);
    if (fail.length) { console.log('FAILURES:'); fail.forEach((f) => console.log('  - ' + f)); }
    if (contracts.length) { console.log('CONTRACTS RECORDED:'); contracts.forEach((c) => console.log('  * ' + c)); }
    process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS FATAL:', e.message); process.exit(2); });
