/**
 * Fasa 26a — adversarial SysMaker GUI (Electron via CDP): X1-X4.
 *
 * X1 rapid double-click New Table -> no duplicate rows
 * X2 modal spam open/close x10 -> no stuck overlay / listener leak
 * X3 extreme names (500 char, emoji, space, reserved words) -> sanitized
 *    client-side, generator escapes, PHP valid
 * X4 SQL injection in names via direct IPC (bypasses GUI sanitizer) ->
 *    identifier safely quoted, DB intact
 *
 * Electron must be running with --remote-debugging-port=9222
 * --user-data-dir=/tmp/fsm26-userdata (isolated store).
 * DB readback: /tmp/fsm26-userdata/Fixzy SysMaker.db (sqlite3 CLI).
 */
const WebSocket = require('ws');
const { execSync } = require('child_process');
const fs = require('fs');

const DB = '/tmp/fsm26-userdata/Fixzy SysMaker.db';
const STAGING_GLOB = '/tmp/fsm26-userdata/generated';
let ws, idc = 0;
const pending = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = []; const fail = []; const contracts = [];
function check(name, ok, detail) {
    (ok ? pass : fail).push(name);
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  [' + String(detail).slice(0, 220) + ']' : ''));
}
function note(t) { contracts.push(t); console.log('NOTE  ' + t); }

function send(method, params = {}) {
    const id = ++idc;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}
async function connect() {
    const list = await new Promise((res, rej) => {
        require('http').get('http://127.0.0.1:9222/json', (r) => {
            let d = ''; r.on('data', (c) => d += c); r.on('end', () => res(JSON.parse(d)));
        }).on('error', rej);
    });
    const page = list.find((t) => t.type === 'page' && t.url.includes('index.html'));
    if (!page) throw new Error('no page target');
    ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
    ws.on('message', (buf) => {
        const msg = JSON.parse(buf.toString());
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
            if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
        } else if (msg.method === 'Page.javascriptDialogOpening') {
            send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
        }
    });
    await send('Page.enable'); await send('Runtime.enable');
}
async function evalJs(expr) {
    const r = await send('Runtime.evaluate', {
        expression: `(async () => { return eval(${JSON.stringify(expr)}) })()`,
        returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error('EVAL: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
}
async function click(sel) {
    await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({block:'center', behavior:'instant'}); })()`);
    await sleep(100);
    const box = await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2}; })()`);
    if (!box) throw new Error('click: not found ' + sel);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
}
// Rapid double-click: two full click sequences with no settle between.
async function dblClickFast(sel) {
    const box = await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({block:'center', behavior:'instant'}); const r = e.getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2}; })()`);
    if (!box) throw new Error('dblClickFast: not found ' + sel);
    for (let i = 0; i < 2; i++) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: i + 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: i + 1 });
    }
}
async function type(sel, text) {
    await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('type: not found'); e.focus(); e.select && e.select(); })()`);
    await send('Input.insertText', { text });
    await evalJs(`(() => { const e = document.activeElement; e.dispatchEvent(new Event('input', {bubbles:true})); })()`);
    await evalJs(`(() => { const e = document.activeElement; e.dispatchEvent(new Event('change', {bubbles:true})); e.blur(); })()`);
    await sleep(120);
}
function dbq(sql) {
    const r = require('child_process').spawnSync('sqlite3', [DB, sql], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('dbq: ' + r.stderr.slice(0, 200));
    return (r.stdout || '').trim();
}
// position:fixed modals report offsetParent === null — use computed style.
function visibleModals() {
    return evalJs(`JSON.stringify(Array.from(document.querySelectorAll('.modal-overlay')).filter(e => { const cs = getComputedStyle(e); return !e.classList.contains('hidden') && cs.display !== 'none' && cs.visibility !== 'hidden'; }).map(e => e.id))`);
}

(async () => {
    await connect();

    // ---- create the project first (first-run modal is already open) ------
    // The New... link's listener is attached by populateProjectDropdown()
    // (clone+rebind pattern); ensure it's bound before driving it.
    await evalJs(`(async () => { const m = await import('./js/handlers/projectHandlers.js'); await m.populateProjectDropdown(); return true; })()`);
    // CSS-hover dropdown: force the menu visible before clicking inside.
    const openMenu = () => evalJs(`(() => { const m = document.getElementById('project-menu-list'); if (m) m.style.display = 'block'; return true; })()`);
    const closeAlerts = () => evalJs(`(() => { document.querySelectorAll('.modal-overlay').forEach(m => { if (m.id !== 'new-project-modal') m.classList.add('hidden'); }); return true; })()`);
    await type('#new-project-name', 'F26 Adversarial');
    // Direct JS click: CDP mouse events can miss during the first-run modal's
    // open transition; the button's own click() is deterministic here.
    await evalJs(`document.getElementById('save-new-project-btn').click()`);
    let projId = '';
    for (let i = 0; i < 20 && !projId; i++) {
        await sleep(500);
        projId = dbq("SELECT project_id FROM projects WHERE is_active=1 LIMIT 1");
    }
    check('SETUP. project created+active', !!projId, 'id=' + projId);
    // dismiss tutorial if it popped
    await evalJs(`(() => { const m = document.getElementById('tutorial-modal'); if (m) m.classList.add('hidden'); })()`);

    // ---- X2: modal spam (open/close new-project modal 10x, user-initiated
    // scenario where the X close button is visible) -------------------------
    // Direct JS open/close: the modal overlay legitimately covers the viewport,
    // so CDP mouse clicks on the menu link hit the overlay. The X2 target is
    // listener leaks / stuck overlays, not mouse routing.
    let stuck = false;
    for (let i = 0; i < 10; i++) {
        await evalJs(`document.getElementById('new-project-btn-dropdown').click()`);
        await sleep(120);
        const vis = JSON.parse(await visibleModals());
        if (!vis.includes('new-project-modal')) { stuck = true; break; }
        await evalJs(`document.getElementById('new-project-modal-close').click()`);
        await sleep(120);
    }
    await closeAlerts();
    const visAfter = JSON.parse(await visibleModals());
    check('X2a. modal opens+closes 10x without stuck overlay', !stuck && !visAfter.includes('new-project-modal'), 'stuck=' + stuck + ' after=' + visAfter.join(','));
    // listener leak probe: after spam, one more open must still show the Create button functional
    await evalJs(`document.getElementById('new-project-btn-dropdown').click()`);
    await sleep(200);
    const btnAlive = await evalJs(`(() => { const b = document.getElementById('save-new-project-btn'); const cs = b && getComputedStyle(b); return !!(b && cs.display !== 'none' && cs.visibility !== 'hidden'); })()`);
    check('X2b. Create button still live after 10x spam', btnAlive);
    await evalJs(`document.getElementById('new-project-modal').classList.add('hidden')`);
    await closeAlerts();
    // switch to the Models Design tab so the sidebar + table settings are shown
    await click('#tab-models-design-btn');
    await sleep(800);
    const tabOk = await evalJs(`(() => { const b = document.getElementById('btn-new-table'); const r = b && b.getBoundingClientRect(); return !!(r && r.width > 0); })()`);
    if (!tabOk) throw new Error('Models Design tab did not reveal btn-new-table');

    // ---- X1: rapid double-click New Table -> no duplicate ---------------
    const before = parseInt(dbq("SELECT COUNT(*) FROM tables WHERE project_id=" + projId), 10);
    await dblClickFast('#btn-new-table');
    await sleep(2500);
    const after = parseInt(dbq("SELECT COUNT(*) FROM tables WHERE project_id=" + projId), 10);
    const created = after - before;
    check('X1. rapid double-click New Table creates exactly 1 table', created === 1, 'created=' + created);
    if (created === 2) note('X1 BUG: no debounce on New Table button — double-click creates 2 tables.');

    // ---- X3: extreme names through the GUI -------------------------------
    // 3a. 500-char name typed into the table-name input
    const long500 = 'A'.repeat(500);
    await type('#tbl-table-name', long500);
    await sleep(600);
    const nameVal = await evalJs(`document.getElementById('tbl-table-name').value`);
    check('X3a. 500-char name accepted by input (length preserved)', nameVal.length === 500, 'len=' + nameVal.length);
    const dbLong = dbq("SELECT table_name FROM tables WHERE project_id=" + projId + " ORDER BY table_id DESC LIMIT 1");
    check('X3b. 500-char name persisted to DB intact', dbLong.length === 500, 'dblen=' + dbLong.length);

    // 3c. emoji + spaces + symbols -> client sanitizer strips them
    await type('#tbl-table-name', '🔥 nama table 🚀 99!');
    await sleep(600);
    const san = await evalJs(`document.getElementById('tbl-table-name').value`);
    check('X3c. emoji/space/digits stripped by GUI sanitizer', san === 'namatable', 'got=' + JSON.stringify(san));

    // 3d. reserved words via GUI rename (letters pass the sanitizer)
    await type('#tbl-table-name', 'class');
    await sleep(700);
    const dbCls = dbq("SELECT table_name FROM tables WHERE project_id=" + projId + " ORDER BY table_id DESC LIMIT 1");
    check('X3d. reserved word "class" reaches DB as literal', dbCls === 'class', 'db=' + dbCls);

    // ---- X4: SQL injection via direct IPC (bypasses GUI sanitizer) ------
    const inj = "x'; DROP TABLE projects;--";
    const tblId = dbq("SELECT table_id FROM tables WHERE project_id=" + projId + " ORDER BY table_id DESC LIMIT 1");
    const injRes = await evalJs(`(async () => JSON.stringify(await window.electronAPI.updateTable({ table_id: ${tblId}, table_name: ${JSON.stringify(inj)} })))()`);
    await sleep(700);
    const projStill = parseInt(dbq("SELECT COUNT(*) FROM projects"), 10);
    check('X4a. injection payload did NOT drop projects table', projStill >= 1, 'projects=' + projStill);
    const injName = dbq("SELECT table_name FROM tables WHERE table_id=" + tblId);
    // Backend contract: table:update validates ^[a-zA-Z_]+$ and silently drops
    // invalid names (old name kept) — injection is REJECTED, not stored.
    check('X4b. injection name rejected by backend validator (old name kept)', injName !== inj && injName === 'class', 'stored=' + JSON.stringify(injName));

    // ---- generate with the hostile schema, php -l everything -------------
    // set stack to laravel_filament first
    await evalJs(`(async () => JSON.stringify(await window.electronAPI.updateProject({ project_id: ${projId}, stack_base: 'laravel_filament' })))()`);
    await sleep(400);
    const genRes = await evalJs(`(async () => JSON.stringify(await window.electronAPI.generateApp()))()`);
    const gen = JSON.parse(genRes || '{}');
    check('X4c. generateApp completes (no crash) on hostile schema', gen.success === true, (gen.message || '').slice(0, 150));

    // php -l every generated PHP file
    let lintFail = [];
    if (gen.success) {
        const staging = fs.existsSync(STAGING_GLOB) ? STAGING_GLOB : null;
        if (staging) {
            try {
                const files = execSync(`find ${staging} -name '*.php' | head -400`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
                for (const f of files) {
                    const r = require('child_process').spawnSync('php', ['-l', f], { encoding: 'utf8' });
                    if (r.status !== 0) lintFail.push(f.replace(staging + '/', '') + ': ' + (r.stdout + r.stderr).split('\n')[0].slice(0, 120));
                }
            } catch (e) { lintFail.push('find failed: ' + e.message.slice(0, 100)); }
        }
    }
    check('X4d. all generated PHP lint-clean despite hostile names', lintFail.length === 0, lintFail.slice(0, 3).join(' | '));

    console.log('\n================ FASA 26a SUMMARY ================');
    console.log(`${pass.length} PASS / ${fail.length} FAIL`);
    if (fail.length) { console.log('FAILURES:'); fail.forEach((f) => console.log('  - ' + f)); }
    if (contracts.length) { console.log('CONTRACTS RECORDED:'); contracts.forEach((c) => console.log('  * ' + c)); }
    process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS FATAL:', e.message); process.exit(2); });
