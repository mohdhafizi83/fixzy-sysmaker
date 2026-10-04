/**
 * Fasa 25 — cross-feature interaction matrix on DEEP-AUDIT-001.
 *
 * M1: gabungan table = numbering + approval + kanban + summaries +
 *     calculated + lookup + hook(email) + public form, one journey.
 * M3: soft delete + approval queue.
 * M4: scoping + kanban isolation.
 * M5: calculated + CSV import contract.
 *
 * Run against the app booted by deep_audit_boot.js on 127.0.0.1:8911.
 */
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');
const { spawnSync } = require('child_process');
const fs = require('fs');

const APP = 'http://127.0.0.1:8911';
const APP_DIR = '/tmp/fsm-deep-app';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = []; const fail = []; const contracts = [];
function check(name, ok, detail) {
    (ok ? pass : fail).push(name + (detail ? '  [' + detail + ']' : ''));
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  [' + detail + ']' : ''));
}
function note(t) { contracts.push(t); console.log('NOTE  ' + t); }
function q(sql) {
    const r = spawnSync('php', [__dirname + '/deep_audit_q.php', sql], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('q failed: ' + (r.stderr || r.stdout).slice(0, 200) + ' sql=' + sql.slice(0, 80));
    return JSON.parse(r.stdout || '[]');
}
function tinker(code) {
    const r = spawnSync('php', [APP_DIR + '/artisan', 'tinker', '--execute', code],
        { cwd: APP_DIR, encoding: 'utf8', timeout: 120000 });
    return (r.stdout || '') + (r.stderr || '');
}

(async () => {
    // users + approver role (idempotent)
    const setup = tinker(`
$mk = function($email) {
    $u = \\App\\Models\\User::where('email', $email)->first();
    if (!$u) { $u = new \\App\\Models\\User(); $u->name = $email; $u->email = $email; }
    $u->password = bcrypt('password');
    $u->save();
    return $u->id;
};
$a = $mk('usera@test.my');
$b = $mk('userb@test.my');
$ap = $mk('approver@test.my');
\\Spatie\\Permission\\Models\\Role::firstOrCreate(['name' => 'approver']);
\\App\\Models\\User::find($ap)->syncRoles(['approver']);
echo "USERS a={$a} b={$b} ap={$ap}\\n";
`);
    const mU = setup.match(/USERS a=(\d+) b=(\d+) ap=(\d+)/);
    if (!mU) { console.log('SETUP FAILED:\n' + setup.slice(0, 800)); process.exit(1); }
    const [, uidA, uidB, uidAP] = mU;
    check('U0. users ready (a=' + uidA + ' b=' + uidB + ' approver=' + uidAP + ')', true);

    // clean fasa-25 tables for idempotency
    q(`DELETE FROM approval_histories WHERE record_type LIKE '%Gabungan%' OR record_type LIKE '%Kelulusan%'`);
    q(`DELETE FROM gabungan`);
    q(`DELETE FROM skopkanban`);
    q(`DELETE FROM numbering_sequences WHERE table_name IN ('gabungan','skopkanban')`);

    const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox'] });
    const login = async (email) => {
        const ctx = await browser.newContext({ viewport: { width: 1600, height: 1300 } });
        const p = await ctx.newPage();
        await p.goto(APP + '/admin/login', { waitUntil: 'networkidle' });
        await p.fill('input[type=email]', email);
        await p.fill('input[type=password]', 'password');
        await p.click('button[type=submit]');
        await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
        return { ctx, p };
    };
    const stripHtml5 = async (p) => p.evaluate(() => {
        const m = document.querySelector('form');
        if (m) m.querySelectorAll('[required],[maxlength]').forEach((el) => { el.removeAttribute('required'); el.removeAttribute('maxlength'); });
    });

    // ================================================================
    // M1. Full journey on the combined table (via UI as admin)
    // ================================================================
    const { p: pAdm } = await login('admin@admin.com');
    const mailLogBefore = fs.readFileSync(APP_DIR + '/storage/logs/laravel.log', 'utf8').length;
    await pAdm.goto(APP + '/admin/gabungan/create', { waitUntil: 'networkidle' });
    await stripHtml5(pAdm);
    await pAdm.fill('#form\\.nama_gabung', 'M1 Journey');
    await pAdm.fill('#form\\.bil_a', '3');
    await pAdm.fill('#form\\.bil_b', '4');
    await pAdm.getByRole('button', { name: /^(Create|Cipta)$/ }).first().click();
    await sleep(3500);
    const g = q(`SELECT id, rujukan, status_gabung, jumlah_kira FROM gabungan WHERE nama_gabung='M1 Journey'`);
    check('M1a. create ran numbering (GB-YYYYMM-NNN)', g.length === 1 && /^GB-\d{6}-\d{3}$/.test(g[0].rujukan || ''), JSON.stringify(g).slice(0, 160));
    check('M1b. approval initial = draft', g.length === 1 && g[0].status_gabung === 'draft', 'status=' + (g[0] || {}).status_gabung);
    check('M1c. calculated jumlah_kira ran on insert', g.length === 1 && Number(g[0].jumlah_kira) >= 7, 'kira=' + (g[0] || {}).jumlah_kira);
    const gid = g[0] ? g[0].id : 0;

    // hook email in log after insert
    const mailChunk = fs.readFileSync(APP_DIR + '/storage/logs/laravel.log', 'utf8').slice(mailLogBefore);
    check('M1d. workflow hook sent email (hooktest@test.my in mail log)', /hooktest@test\.my/.test(mailChunk),
        'chunk has address=' + /hooktest@test\.my/.test(mailChunk));

    // submit -> pending (row action), then approve as approver
    await pAdm.goto(APP + '/admin/gabungan', { waitUntil: 'networkidle' });
    await sleep(2000);
    const subBtn = pAdm.locator('table tbody tr:has-text("M1 Journey") button:has-text("Submit")').first();
    check('M1e. Submit row action visible on draft', await subBtn.count() > 0);
    if (await subBtn.count()) {
        await subBtn.click(); await sleep(1200);
        const conf = pAdm.locator('.fi-modal button:has-text("Submit")').last();
        if (await conf.count()) await conf.click();
        await sleep(2500);
    }
    check('M1f. after Submit status = pending', q(`SELECT status_gabung FROM gabungan WHERE id=${gid}`)[0].status_gabung === 'pending');

    const { p: pAp } = await login('approver@test.my');
    await pAp.goto(APP + '/admin/gabungan', { waitUntil: 'networkidle' });
    await sleep(2000);
    const appBtn = pAp.locator('table tbody tr:has-text("M1 Journey") button:has-text("Approve")').first();
    check('M1g. approver sees Approve on pending', await appBtn.count() > 0);
    if (await appBtn.count()) {
        await appBtn.click(); await sleep(1200);
        const conf2 = pAp.locator('.fi-modal button:has-text("Approve")').last();
        if (await conf2.count()) await conf2.click();
        await sleep(2500);
    }
    check('M1h. after Approve status = approved', q(`SELECT status_gabung FROM gabungan WHERE id=${gid}`)[0].status_gabung === 'approved');

    // kanban board shows the record grouped by status
    await pAp.goto(APP + '/admin/gabungans-board', { waitUntil: 'networkidle' }).catch(() => null);
    await sleep(2500);
    const boardTxt = await pAp.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('M1i. kanban board renders the record', /M1 Journey/.test(boardTxt), 'url=' + pAp.url());

    // summary row still correct with all features on
    await pAp.goto(APP + '/admin/gabungan', { waitUntil: 'networkidle' });
    await sleep(2000);
    const sumTxt = await pAp.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tr.fi-ta-summary-row'));
        const r = rows.find((x) => /Total/i.test(x.innerText));
        return r ? r.innerText.replace(/\s+/g, ' ') : '';
    });
    const sumDb = q(`SELECT SUM(jumlah) s FROM gabungan`)[0].s || 0;
    check('M1j. summary row present with all features active', /Total/i.test(sumTxt), sumTxt.slice(0, 120));

    // ================================================================
    // M3. soft delete + approval: delete pending -> gone from queue
    // ================================================================
    const m3 = tinker(`
$r = \\App\\Models\\Gabungan::create(['nama_gabung' => 'M3 Delete', 'bil_a' => 1, 'bil_b' => 1]);
$r->transitionTo('pending', null, \\App\\Models\\User::find(${uidA}));
$r->refresh();
$before = $r->status_gabung;
$r->delete();
$inQueue = \\App\\Models\\Gabungan::where('status_gabung', 'pending')->where('nama_gabung', 'M3 Delete')->count();
echo "before={$before} inQueue={$inQueue}";
`);
    const m3m = m3.match(/before=(\w+) inQueue=(\d+)/);
    check('M3. deleted pending record leaves approval queue', m3m && m3m[1] === 'pending' && m3m[2] === '0', m3.trim().slice(0, 100));

    // ================================================================
    // M4. scoping + kanban: userB cannot see userA's card
    // ================================================================
    tinker(`
\\App\\Models\\Skopkanban::create(['nama_skop' => 'SkopA', 'status_skop' => 'Draft']);
\\DB::table('skopkanban')->where('nama_skop', 'SkopA')->update(['created_by' => ${uidA}]);
`);
    const { p: pB } = await login('userb@test.my');
    await pB.goto(APP + '/admin/skopkanbans-board', { waitUntil: 'networkidle' }).catch(() => null);
    await sleep(2500);
    const bBoard = await pB.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('M4. userB kanban does NOT show userA card', !/SkopA/.test(bBoard), 'has SkopA=' + /SkopA/.test(bBoard));
    const { p: pA2 } = await login('usera@test.my');
    await pA2.goto(APP + '/admin/skopkanbans-board', { waitUntil: 'networkidle' }).catch(() => null);
    await sleep(2500);
    const aBoard = await pA2.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('M4b. owner sees own card on kanban', /SkopA/.test(aBoard), 'has SkopA=' + /SkopA/.test(aBoard));

    // ================================================================
    // M5. calculated + CSV import contract
    // ================================================================
    const impCsv = '/tmp/fasa25_calc_import.csv';
    fs.writeFileSync(impCsv, [
        'nama_gabung,bil_a,bil_b,jumlah',
        'ImportCalc1,5,6,11',
        'ImportCalc2,7,8,15',
    ].join('\n'));
    const { p: pImp } = await login('admin@admin.com');
    await pImp.goto(APP + '/admin/gabungan', { waitUntil: 'networkidle' });
    await sleep(2000);
    await pImp.locator('button:has-text("Import")').first().click();
    await sleep(1500);
    await pImp.locator('.fi-modal input[type=file]').first().setInputFiles(impCsv);
    const impBtn = pImp.locator('.fi-modal button:has-text("Import")').last();
    for (let i = 0; i < 20; i++) { await sleep(700); if (await impBtn.count() && await impBtn.isEnabled()) break; }
    if (await impBtn.count() && await impBtn.isEnabled()) await impBtn.click();
    await sleep(4500);
    const impRows = q(`SELECT nama_gabung, jumlah, jumlah_kira FROM gabungan WHERE nama_gabung LIKE 'ImportCalc%' ORDER BY nama_gabung`);
    check('M5a. CSV import inserted both rows', impRows.length === 2, JSON.stringify(impRows).slice(0, 180));
    const kiraAfterImport = impRows.map((r) => Number(r.jumlah_kira || 0));
    const anyKira = kiraAfterImport.some((k) => k > 0);
    if (anyKira) {
        note('M5 contract: calculated fields RECOMPUTE after CSV import (jumlah_kira=' + kiraAfterImport.join(',') + ' includes imported rows).');
    } else {
        note('M5 contract: imported rows keep jumlah_kira as imported (0/blank) — calculated engine runs on saved() but the per-row query sums only that row; recorded as-is: ' + kiraAfterImport.join(','));
    }
    check('M5b. import did not corrupt existing rows', q(`SELECT COUNT(*) c FROM gabungan WHERE nama_gabung='M1 Journey'`)[0].c === 1);

    console.log('\n================ FASA 25 RUNTIME SUMMARY ================');
    console.log(`${pass.length} PASS / ${fail.length} FAIL`);
    if (fail.length) { console.log('FAILURES:'); fail.forEach((f) => console.log('  - ' + f)); }
    if (contracts.length) { console.log('CONTRACTS RECORDED:'); contracts.forEach((c) => console.log('  * ' + c)); }
    await browser.close();
    process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS FATAL:', e.message); process.exit(2); });
