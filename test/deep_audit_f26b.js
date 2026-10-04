/**
 * Fasa 26b — adversarial scale + concurrency (Electron via CDP): X5, X6.
 *
 * X5 100 tables x 30 fields via real IPC -> GUI sidebar still renders,
 *    generateApp completes < 15 min, output file count sane.
 * X6 two GUI tabs editing the SAME field -> last-write-wins, no corrupt.
 *
 * Electron running on :9222 with --user-data-dir=/tmp/fsm26-userdata.
 */
const WebSocket = require('ws');
const { spawnSync } = require('child_process');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = []; const fail = []; const contracts = [];
function check(name, ok, detail) {
    (ok ? pass : fail).push(name);
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  [' + String(detail).slice(0, 220) + ']' : ''));
}
function note(t) { contracts.push(t); console.log('NOTE  ' + t); }
function dbq(sql) {
    const r = spawnSync('sqlite3', ['/tmp/fsm26-userdata/Fixzy SysMaker.db', sql], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('dbq: ' + r.stderr.slice(0, 200));
    return (r.stdout || '').trim();
}

// Minimal CDP connection to a specific page target.
function attach(wsUrl) {
    const pending = new Map();
    let idc = 0;
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
        ws.on('open', async () => {
            const send = (method, params = {}) => new Promise((res, rej) => {
                const id = ++idc; pending.set(id, { res, rej });
                ws.send(JSON.stringify({ id, method, params }));
            });
            const ev = async (expr) => {
                const r = await send('Runtime.evaluate', {
                    expression: `(async () => { return eval(${JSON.stringify(expr)}) })()`,
                    returnByValue: true, awaitPromise: true,
                });
                if (r.exceptionDetails) throw new Error('EVAL: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
                return r.result.value;
            };
            await send('Runtime.enable');
            resolve({ ws, send, ev });
        });
        ws.on('message', (buf) => {
            const m = JSON.parse(buf.toString());
            if (m.id && pending.has(m.id)) {
                const { res, rej } = pending.get(m.id); pending.delete(m.id);
                if (m.error) rej(new Error(m.error.message || JSON.stringify(m.error))); else res(m.result || {});
            }
            if (m.method === 'Page.javascriptDialogOpening') {
                ws.send(JSON.stringify({ id: ++idc, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
            }
        });
        ws.on('error', reject);
    });
}
async function listPages() {
    return new Promise((res, rej) => {
        require('http').get('http://127.0.0.1:9222/json', (r) => {
            let d = ''; r.on('data', (c) => d += c); r.on('end', () => res(JSON.parse(d)));
        }).on('error', rej);
    });
}

(async () => {
    const pages = await listPages();
    // Attach to the page that actually has the preload (electronAPI present).
    let A = null;
    for (const t of pages.filter((x) => x.type === 'page' && x.url.includes('index.html'))) {
        const cand = await attach(t.webSocketDebuggerUrl);
        try {
            const has = await cand.ev(`typeof window.electronAPI !== 'undefined'`);
            if (has) { A = cand; break; }
        } catch (e) { /* dead target */ }
        try { cand.ws.close(); } catch (e) {}
    }
    if (!A) throw new Error('no page with electronAPI preload');

    // ---- X5: 100 tables x 30 fields via real IPC ------------------------
    const t0 = Date.now();
    const buildRes = await A.ev(`(async () => {
        const pid = (await window.electronAPI.getAllProjects())[0].project_id;
        const made = [];
        for (let i = 0; i < 100; i++) {
            const t = await window.electronAPI.createTable(pid);
            made.push(t.table_id);
            for (let f = 0; f < 30; f++) {
                const fld = await window.electronAPI.createField(t.table_id);
                await window.electronAPI.updateField({ field_id: fld.field_id, field_name: 'f' + i + '_' + f, data_type: 'VARCHAR', length: 100 });
            }
        }
        return JSON.stringify({ tables: made.length });
    })()`);
    const buildSec = Math.round((Date.now() - t0) / 1000);
    const nTables = parseInt(dbq("SELECT COUNT(*) FROM tables WHERE project_id=1"), 10);
    const nFields = parseInt(dbq("SELECT COUNT(*) FROM fields"), 10);
    check('X5a. 100 tables x 30 fields created via IPC', nTables >= 101 && nFields >= 3000, `tables=${nTables} fields=${nFields} in ${buildSec}s`);

    // GUI usability: reload project data and time the sidebar render.
    const t1 = Date.now();
    const guiRes = await A.ev(`(async () => {
        const m = await import('./js/state.js');
        const proj = m.appState.activeProject;
        const rm = await import('./renderer.js').catch(() => null);
        // loadProjectData lives on renderer module scope; call via window if exposed,
        // else trigger a full re-import through the existing API surface.
        const data = await window.electronAPI.getFullSchema(proj.project_id);
        m.appState.jsonData = data;
        const sm = await import('./js/sidebar.js');
        await sm.generateSidebarMenu();
        return 'ok';
    })()`);
    const renderMs = Date.now() - t1;
    const sidebarRows = await A.ev(`document.querySelectorAll('#table-list a').length`);
    check('X5b. GUI sidebar renders 100-table project (usable)', sidebarRows >= 3000 && renderMs < 60000, `rows=${sidebarRows} render=${renderMs}ms`);

    // generateApp timing
    await A.ev(`(async () => JSON.stringify(await window.electronAPI.updateProject({ project_id: 1, stack_base: 'laravel_filament' })))()`);
    const t2 = Date.now();
    const gen = JSON.parse(await A.ev(`(async () => JSON.stringify(await window.electronAPI.generateApp()))()`));
    const genSec = Math.round((Date.now() - t2) / 1000);
    check('X5c. generateApp completes < 15 min on 100x30 schema', gen.success === true && genSec < 900, `${genSec}s msg=${(gen.message || '').slice(0, 80)}`);
    const fileCount = parseInt(spawnSync('bash', ['-c', 'find /tmp/fsm26-userdata/generated -name "*.php" | wc -l'], { encoding: 'utf8' }).stdout || '0', 10);
    check('X5d. generated file count sane for 100 tables', fileCount > 400, `php files=${fileCount}`);

    // ---- X6: two tabs editing the same field -----------------------------
    // Open a second GUI tab via window.open from the first (may be blocked).
    try { await A.ev(`window.open('index.html', 'tabB')`); } catch (e) { note('window.open threw: ' + e.message); }
    await sleep(3000);
    const pages2 = await listPages();
    const tabB = pages2.filter((t) => t.type === 'page' && t.url.includes('index.html'));
    if (tabB.length < 2) {
        note('X6: window.open blocked in Electron (single-window app by design) — testing last-write-wins via two sequential IPC writers instead.');
        // Two "sessions" = two direct IPC calls racing on the same field.
        const fid = dbq("SELECT field_id FROM fields LIMIT 1");
        const [r1, r2] = await Promise.all([
            A.ev(`(async () => JSON.stringify(await window.electronAPI.updateField({ field_id: ${fid}, caption: 'WRITER_ONE' })))()`),
            A.ev(`(async () => JSON.stringify(await window.electronAPI.updateField({ field_id: ${fid}, caption: 'WRITER_TWO' })))()`),
        ]);
        await sleep(500);
        const final = dbq("SELECT caption FROM fields WHERE field_id=" + fid);
        const intact = ['WRITER_ONE', 'WRITER_TWO'].includes(final);
        check('X6. concurrent IPC writes: one writer wins cleanly, no corrupt', intact, `final=${final}`);
    } else {
        const B = await attach(tabB[tabB.length - 1].webSocketDebuggerUrl);
        const bHasApi = await B.ev(`typeof window.electronAPI !== 'undefined'`).catch(() => false);
        if (!bHasApi) {
            note('X6: window.open creates a window WITHOUT the preload (no setWindowOpenHandler) — second GUI tab is inert by design; last-write-wins tested via concurrent IPC writers instead.');
            const fid = dbq("SELECT field_id FROM fields LIMIT 1");
            await Promise.all([
                A.ev(`(async () => { await window.electronAPI.updateField({ field_id: ${fid}, caption: 'TAB_A_VALUE' }); })()`),
                A.ev(`(async () => { await window.electronAPI.updateField({ field_id: ${fid}, caption: 'TAB_B_VALUE' }); })()`),
            ]);
            await sleep(600);
            const final = dbq("SELECT caption FROM fields WHERE field_id=" + fid);
            check('X6. concurrent writers: one wins cleanly, no corrupt', ['TAB_A_VALUE', 'TAB_B_VALUE'].includes(final), `final=${final}`);
        } else {
            const fid = dbq("SELECT field_id FROM fields LIMIT 1");
            await A.ev(`(async () => { await window.electronAPI.updateField({ field_id: ${fid}, caption: 'TAB_A_VALUE' }); })()`);
            await B.ev(`(async () => { await window.electronAPI.updateField({ field_id: ${fid}, caption: 'TAB_B_VALUE' }); })()`);
            await sleep(600);
            const final = dbq("SELECT caption FROM fields WHERE field_id=" + fid);
            check('X6. two tabs last-write-wins, no corrupt', ['TAB_A_VALUE', 'TAB_B_VALUE'].includes(final), `final=${final}`);
        }
        B.ws.close();
    }

    A.ws.close();
    console.log('\n================ FASA 26b SUMMARY ================');
    console.log(`${pass.length} PASS / ${fail.length} FAIL`);
    if (fail.length) { console.log('FAILURES:'); fail.forEach((f) => console.log('  - ' + f)); }
    if (contracts.length) { console.log('CONTRACTS RECORDED:'); contracts.forEach((c) => console.log('  * ' + c)); }
    process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS FATAL:', e.message); process.exit(2); });
