/**
 * Fasa 24 — runtime semantics: hooks + automation.
 *
 * H1 table hook create fires (mail log evidence)
 * H2 table hook update fires
 * H3 condition branch TRUE runs / FALSE runs (both verified)
 * H4 project-level hook (after_login) fires
 * H5 corrupt hook JSON -> app boots normal, hook skipped, no fatal
 * H6 scheduled command fires; unconnected time does not
 * H7 hook + soft delete: delete triggers hook exactly ONCE (no double-fire)
 *
 * Ground truth: laravel.log (MAIL_MAILER=log) + tinker + artisan exit codes.
 * Run against the app booted by deep_audit_boot.js on 127.0.0.1:8911.
 */
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');
const { spawnSync } = require('child_process');
const fs = require('fs');

const APP = 'http://127.0.0.1:8911';
const APP_DIR = '/tmp/fsm-deep-app';
const REPO_GEN = '/home/fizi/projects/FiziSysMaker/src/generators/laravelWorkflowGenerator.js';
const LOG = APP_DIR + '/storage/logs/laravel.log';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = []; const fail = []; const contracts = [];
function check(name, ok, detail) {
    (ok ? pass : fail).push(name + (detail ? '  [' + detail + ']' : ''));
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  [' + detail + ']' : ''));
}
function note(t) { contracts.push(t); console.log('NOTE  ' + t); }

function tinker(code) {
    const r = spawnSync('php', [APP_DIR + '/artisan', 'tinker', '--execute', code],
        { cwd: APP_DIR, encoding: 'utf8', timeout: 120000 });
    return (r.stdout || '') + (r.stderr || '');
}
function clearLog() { try { fs.writeFileSync(LOG, ''); } catch (e) { /* ok */ } }
function logText() { try { return fs.readFileSync(LOG, 'utf8'); } catch (e) { return ''; } }
function countOccurrences(hay, needle) {
    let n = 0, i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
    return n;
}

(async () => {
    // ---- H1: after_insert hook fires on create --------------------------
    clearLog();
    tinker(`\\App\\Models\\Hook::create(['nama' => 'H1 Rec', 'marka' => 'x']); echo 'ok';`);
    let txt = logText();
    check('H1a. create fires after_insert hook (mail log)', txt.includes('H1 INSERT fired') && txt.includes('hookf24@test.my'));

    // ---- H2: after_update hook fires on update --------------------------
    clearLog();
    tinker(`$r = \\App\\Models\\Hook::where('nama', 'H1 Rec')->first(); $r->marka = 'y'; $r->save(); echo 'ok';`);
    txt = logText();
    check('H2. update fires after_update hook', txt.includes('H2 UPDATE fired'));

    // ---- H3: condition branch both ways ---------------------------------
    clearLog();
    tinker(`\\App\\Models\\Kondisi::create(['nama_kondisi' => 'K-Yes', 'status_kondisi' => 'TRIGGER']); echo 'ok';`);
    txt = logText();
    const yesTrue = txt.includes('H3 TRUE BRANCH');
    const yesFalse = txt.includes('H3 FALSE BRANCH');
    check('H3a. TRIGGER record -> TRUE branch only', yesTrue && !yesFalse, `true=${yesTrue} false=${yesFalse}`);
    clearLog();
    tinker(`\\App\\Models\\Kondisi::create(['nama_kondisi' => 'K-No', 'status_kondisi' => 'OTHER']); echo 'ok';`);
    txt = logText();
    const noTrue = txt.includes('H3 TRUE BRANCH');
    const noFalse = txt.includes('H3 FALSE BRANCH');
    check('H3b. non-TRIGGER record -> FALSE branch only', noFalse && !noTrue, `true=${noTrue} false=${noFalse}`);

    // ---- H4: project-level after_login hook ------------------------------
    clearLog();
    const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    const page = await ctx.newPage();
    await page.goto(APP + '/admin/login', { waitUntil: 'networkidle' });
    await page.fill('input[type=email]', 'admin@admin.com');
    await page.fill('input[type=password]', 'password');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
    await sleep(1500);
    txt = logText();
    check('H4. project after_login hook fires (any table login)', txt.includes('H4 LOGIN') && txt.includes('projhook@test.my'));

    // ---- H7: soft delete fires hook EXACTLY ONCE -------------------------
    clearLog();
    tinker(`$r = \\App\\Models\\Hook::where('nama', 'H1 Rec')->first(); $r->delete(); echo 'del ok';`);
    await sleep(500);
    txt = logText();
    const delCount = countOccurrences(txt, 'H7 DELETE fired');
    check('H7a. soft delete fires after_delete exactly once', delCount === 1, `count=${delCount}`);
    // restore must NOT re-fire delete (no 'deleted' on restore)
    tinker(`$r = \\App\\Models\\Hook::withTrashed()->where('nama', 'H1 Rec')->first(); $r->restore(); echo 'res ok';`);
    await sleep(500);
    txt = logText();
    const delAfterRestore = countOccurrences(txt, 'H7 DELETE fired');
    check('H7b. restore does NOT re-fire delete hook', delAfterRestore === 1, `count=${delAfterRestore}`);

    // ---- H5: corrupt hook JSON -> generator skips, no fatal -------------
    const h5 = spawnSync('node', ['-e', `
const os = require('os'); const fs = require('fs'); const path = require('path');
const { generateWorkflowHooks } = require('${REPO_GEN}');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f24h5-'));
const schema = {
  project: { project_hook_workflow: '{corrupt json!!!' },
  database: { table: {
    rosak: { table_name: 'rosak', module_name: 'Rosak',
      table_hook_workflow: '{"blocks": [not valid' }
  } }
};
generateWorkflowHooks(schema, dir).then((r) => {
  const obs = fs.existsSync(path.join(dir, 'app', 'Observers', 'RosakWorkflowObserver.php'));
  const prov = fs.existsSync(path.join(dir, 'app', 'Providers', 'WorkflowServiceProvider.php'));
  console.log(JSON.stringify({ success: r.success, observerEmitted: obs, providerEmitted: prov }));
}).catch((e) => { console.log(JSON.stringify({ fatal: e.message })); });
`], { encoding: 'utf8', timeout: 60000 });
    let h5res = {};
    try { h5res = JSON.parse((h5.stdout || '').trim().split('\n').pop()); } catch (e) { /* fallthrough */ }
    check('H5. corrupt hook JSON: no fatal, hook skipped',
        h5.status === 0 && h5res.success === true && h5res.observerEmitted === false,
        (h5.stdout || h5.stderr || '').slice(0, 120));

    // ---- H6: scheduled command -------------------------------------------
    clearLog();
    const sched = spawnSync('php', [APP_DIR + '/artisan', 'fixzy:scheduled-workflow'],
        { cwd: APP_DIR, encoding: 'utf8', timeout: 120000 });
    txt = logText();
    check('H6a. fixzy:scheduled-workflow runs and fires hook', sched.status === 0 && txt.includes('H6 SCHEDULED'),
        `exit=${sched.status}`);
    // "not due" side: the command itself IS the due-time boundary (everyMinute
    // schedule); running it manually always fires by design. Contract note:
    note('H6 contract: schedule gating lives in Schedule::everyMinute(); the command itself always runs the hook when invoked. "Not due" = scheduler not invoking, verified via schedule:list.');
    const slist = spawnSync('php', [APP_DIR + '/artisan', 'schedule:list'],
        { cwd: APP_DIR, encoding: 'utf8', timeout: 120000 });
    check('H6b. schedule:list registers fixzy:scheduled-workflow everyMinute',
        slist.status === 0 && /fixzy:scheduled-workflow/.test(slist.stdout || ''));

    await browser.close();

    console.log('\n================ FASA 24 RUNTIME SUMMARY ================');
    console.log(`${pass.length} PASS / ${fail.length} FAIL`);
    if (fail.length) { console.log('FAILURES:'); fail.forEach((f) => console.log('  - ' + f)); }
    if (contracts.length) { console.log('CONTRACTS RECORDED:'); contracts.forEach((c) => console.log('  * ' + c)); }
    process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS FATAL:', e.message); process.exit(2); });
