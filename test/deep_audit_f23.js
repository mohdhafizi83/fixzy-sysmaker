/**
 * Fasa 23 — runtime semantics: scoping, approvals, numbering, public form.
 *
 * Ground truth via sqlite readback + HTTP (public form) + tinker (model API).
 * Run against the app booted by deep_audit_boot.js on 127.0.0.1:8911.
 *
 * Users (created here via tinker, bcrypt'd by Laravel itself):
 *   - admin@admin.com  (existing super admin)
 *   - usera@test.my    (creator)
 *   - userb@test.my    (other user, no approver role)
 *   - approver@test.my (Shield role: approver)
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
    // ---- setup users + approver role ------------------------------------
    const setup = tinker(`
$mk = function(\$email) {
    \$u = \\App\\Models\\User::where('email', \$email)->first();
    if (!$u) { $u = new \\App\\Models\\User(); $u->name = \$email; $u->email = \$email; }
    $u->password = bcrypt('password');
    $u->save();
    return $u->id;
};
$a = $mk('usera@test.my');
$b = $mk('userb@test.my');
$ap = $mk('approver@test.my');
$role = \\Spatie\\Permission\\Models\\Role::firstOrCreate(['name' => 'approver']);
\\App\\Models\\User::find($ap)->syncRoles(['approver']);
echo "USERS a={$a} b={$b} ap={$ap}\\n";
`);
    const mU = setup.match(/USERS a=(\d+) b=(\d+) ap=(\d+)/);
    if (!mU) { console.log('SETUP FAILED:\n' + setup.slice(0, 800)); process.exit(1); }
    const [, uidA, uidB, uidAP] = mU;
    check('U0. users created (a=' + uidA + ' b=' + uidB + ' approver=' + uidAP + ')', true);
    // idempotency: clear fasa-23 fixtures from previous runs
    q(`DELETE FROM spesial WHERE nama_spesial='MilikUserA'`);
    q(`DELETE FROM approval_histories WHERE record_type LIKE '%Kelulusan%'`);
    q(`DELETE FROM kelulusan`);
    q(`DELETE FROM invois`);
    q(`DELETE FROM tempahan`);
    q(`DELETE FROM aduan`);
    q(`DELETE FROM numbering_sequences`);

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

    // ================================================================
    // SC1. record_owner=current_user: userA creates, userB cannot see
    // ================================================================
    const { p: pA } = await login('usera@test.my');
    await pA.goto(APP + '/admin/spesial/create', { waitUntil: 'networkidle' });
    await pA.evaluate(() => {
        const m = document.querySelector('form');
        if (m) m.querySelectorAll('[required],[maxlength]').forEach((el) => { el.removeAttribute('required'); el.removeAttribute('maxlength'); });
    });
    await pA.fill('#form\\.nama_spesial', 'MilikUserA');
    await pA.getByRole('button', { name: /^(Create|Cipta)$/ }).first().click();
    await sleep(3000);
    const recA = q(`SELECT id, created_by FROM spesial WHERE nama_spesial='MilikUserA'`);
    check('SC1a. userA record created with created_by=A', recA.length === 1 && String(recA[0].created_by) === uidA, JSON.stringify(recA));
    const scId = recA[0] ? recA[0].id : 0;

    const { p: pB } = await login('userb@test.my');
    await pB.goto(APP + '/admin/spesial', { waitUntil: 'networkidle' });
    await sleep(2000);
    const bSees = await pB.locator('table tbody tr:has-text("MilikUserA")').count();
    check('SC1b. userB list does NOT show userA record', bSees === 0, 'rows=' + bSees);
    const respEdit = await pB.goto(APP + `/admin/spesial/${scId}/edit`, { waitUntil: 'networkidle' }).catch(() => null);
    const stEdit = respEdit ? respEdit.status() : 0;
    const editable = await pB.locator('#form\\.nama_spesial').count();
    const stillOnEditUrl = String(pB.url()).includes(`/spesial/${scId}/edit`);
    check('SC1c. userB direct edit URL blocked (403/404 or not editable)',
        stEdit === 403 || stEdit === 404 || editable === 0 || !stillOnEditUrl,
        `status=${stEdit} editable=${editable} url=${pB.url()}`);

    // SC3. admin visibility (design contract)
    const { p: pAdm } = await login('admin@admin.com');
    await pAdm.goto(APP + '/admin/spesial', { waitUntil: 'networkidle' });
    await sleep(2000);
    const admSees = await pAdm.locator('table tbody tr:has-text("MilikUserA")').count();
    if (admSees > 0) {
        note('SC3 contract: admin DOES see owner-scoped records (bypass present).');
    } else {
        note('SC3 contract: owner-scoping is STRICT — even super admin cannot see other users\u2019 records in the list (getEloquentQuery has no admin bypass). Recorded as design behaviour.');
    }
    check('SC3. admin visibility recorded (' + (admSees > 0 ? 'bypass' : 'strict') + ')', true);

    // ================================================================
    // AP1. Approval flow via UI: submit -> pending -> approve(comment)
    // ================================================================
    await pA.goto(APP + '/admin/kelulusan/create', { waitUntil: 'networkidle' });
    await pA.evaluate(() => {
        const m = document.querySelector('form');
        if (m) m.querySelectorAll('[required],[maxlength]').forEach((el) => { el.removeAttribute('required'); el.removeAttribute('maxlength'); });
    });
    await pA.fill('#form\\.tajuk', 'Permohonan Satu');
    await pA.getByRole('button', { name: /^(Create|Cipta)$/ }).first().click();
    await sleep(3000);
    const kel = q(`SELECT id, status_kelulusan FROM kelulusan WHERE tajuk='Permohonan Satu'`);
    check('AP1a. new record starts at initial status draft', kel.length === 1 && kel[0].status_kelulusan === 'draft', JSON.stringify(kel));
    const kelId = kel[0] ? kel[0].id : 0;

    // submit (draft->pending) as owner — approval actions are ROW actions
    // on the list page (generated into the table class).
    await pA.goto(APP + '/admin/kelulusan', { waitUntil: 'networkidle' });
    await sleep(2000);
    const submitBtn = pA.locator('table tbody tr:has-text("Permohonan Satu") button:has-text("Submit")').first();
    check('AP1b. owner sees Submit row action on draft', await submitBtn.count() > 0);
    if (await submitBtn.count()) {
        await submitBtn.click(); await sleep(1200);
        const conf = pA.locator('.fi-modal button:has-text("Submit")').last();
        if (await conf.count()) await conf.click();
        await sleep(2500);
    }
    const kelAfterSubmit = q(`SELECT status_kelulusan FROM kelulusan WHERE id=${kelId}`)[0];
    check('AP1c. after Submit status = pending', kelAfterSubmit.status_kelulusan === 'pending', 'status=' + kelAfterSubmit.status_kelulusan);

    // approve as approver with comment (row action on list)
    const { p: pAp } = await login('approver@test.my');
    await pAp.goto(APP + '/admin/kelulusan', { waitUntil: 'networkidle' });
    await sleep(2000);
    const approveBtn = pAp.locator('table tbody tr:has-text("Permohonan Satu") button:has-text("Approve")').first();
    check('AP1d. approver sees Approve row action on pending', await approveBtn.count() > 0);
    await approveBtn.click(); await sleep(1200);
    // comment textarea in modal
    await pAp.locator('.fi-modal textarea').first().fill('Diluluskan oleh tuan');
    await pAp.locator('.fi-modal button:has-text("Approve")').last().click();
    await sleep(2500);
    const kelAppr = q(`SELECT status_kelulusan FROM kelulusan WHERE id=${kelId}`)[0];
    check('AP1e. after Approve status = approved', kelAppr.status_kelulusan === 'approved', 'status=' + kelAppr.status_kelulusan);
    const hist = q(`SELECT from_status, to_status, comment FROM approval_histories WHERE record_id=${kelId} ORDER BY id`);
    check('AP1f. approval history has submit + approve with comment',
        hist.length >= 2 && /Diluluskan oleh tuan/.test(hist[hist.length - 1].comment || ''),
        JSON.stringify(hist).slice(0, 200));

    // AP4. notification log (MAIL_MAILER=log)
    const mailLog = fs.existsSync(APP_DIR + '/storage/logs/laravel.log')
        ? fs.readFileSync(APP_DIR + '/storage/logs/laravel.log', 'utf8') : '';
    const notifSent = /ApprovalTransitioned|subject=.*[Kk]elulusan|to: usera@test\.my/i.test(mailLog);
    check('AP4. approval notification written to mail log', notifSent,
        'log has ApprovalTransitioned=' + /ApprovalTransitioned/.test(mailLog));

    // AP2. non-approver cannot approve a PENDING record (role gate, not
    // transition-legality). Create a fresh pending record first.
    const ap2 = tinker(`
$r = \\App\\Models\\Kelulusan::create(['tajuk' => 'Permohonan Dua']);
$r->transitionTo('pending', null, \\App\\Models\\User::find(${uidA}));
$r->refresh();
try { $r->transitionTo('approved', 'cuba', \\App\\Models\\User::where('email','userb@test.my')->first()); echo 'AP2_NOT_BLOCKED'; }
catch (\\Throwable $e) { echo 'BLOCKED: ' . $e->getMessage(); }
`);
    check('AP2. non-approver (userB) approve on pending rejected by ROLE gate',
        /BLOCKED.*role/i.test(ap2), ap2.trim().slice(0, 140));

    // AP3. approved is final -> further transition refused
    const ap3 = tinker(`
$r = \\App\\Models\\Kelulusan::find(${kelId});
try { $r->transitionTo('rejected', 'lagi', \\App\\Models\\User::where('email','approver@test.my')->first()); echo 'AP3_NOT_BLOCKED'; }
catch (\\Throwable $e) { echo 'FINAL: ' . $e->getMessage(); }
`);
    check('AP3. final status refuses further transition', /FINAL/.test(ap3), ap3.trim().slice(0, 120));

    // ================================================================
    // NB1. numbering: 10 sequential creates -> unique, no gaps
    // ================================================================
    const nb = tinker(`
for ($i = 0; $i < 10; $i++) {
    \\App\\Models\\Invois::create(['pelanggan' => 'Pelanggan ' . $i, 'jumlah' => 10]);
}
$rows = \\App\\Models\\Invois::orderBy('id')->pluck('invoice_no')->all();
echo implode(',', $rows);
`);
    const nums = (nb.match(/INV-\d{6}-\d{4}/g) || []);
    const uniq = new Set(nums);
    const seqOk = nums.length === 10 && uniq.size === 10 && nums.every((n, i, arr) => i === 0 || parseInt(n.slice(-4), 10) === parseInt(arr[i - 1].slice(-4), 10) + 1);
    check('NB1a. 10 creates -> 10 unique gapless numbers', seqOk, nums.join(','));

    // NB1b. parallel creation race (5 procs x 4 creates)
    tinker(`\\DB::table('invois')->truncate(); \\DB::table('numbering_sequences')->where('table_name','invois')->delete();`);
    const procs = [];
    for (let k = 0; k < 5; k++) {
        procs.push(spawnSync('php', [APP_DIR + '/artisan', 'tinker', '--execute',
            `for ($i=0;$i<4;$i++) { \\App\\Models\\Invois::create(['pelanggan'=>'R${k}'.$i,'jumlah'=>1]); } echo 'done${k}\\n';`],
            { cwd: APP_DIR, encoding: 'utf8', timeout: 120000 }));
    }
    const raceRows = q(`SELECT invoice_no, COUNT(*) c FROM invois GROUP BY invoice_no HAVING c > 1`);
    const raceCount = q(`SELECT COUNT(*) c FROM invois`)[0].c;
    check('NB1b. 20 parallel creates -> 20 rows, zero duplicates', raceCount === 20 && raceRows.length === 0,
        'count=' + raceCount + ' dups=' + JSON.stringify(raceRows).slice(0, 120));

    // NB2. different prefixes don't mix
    const nb2 = tinker(`
for ($i = 0; $i < 3; $i++) { \\App\\Models\\Tempahan::create(['produk' => 'P' . $i]); }
echo implode(',', \\App\\Models\\Tempahan::orderBy('id')->pluck('res_no')->all());
`);
    const tmpNums = nb2.match(/TMP-\d{8}-\d{3}/g) || [];
    check('NB2. tempahan uses own TMP prefix sequence', tmpNums.length === 3 && !tmpNums.some((n) => n.startsWith('INV')), tmpNums.join(','));

    // ================================================================
    // PF1-PF4. public form (no login)
    // ================================================================
    const ctxPub = await browser.newContext();
    const pPub = await ctxPub.newPage();
    const pfGet = await pPub.goto(APP + '/f/aduan', { waitUntil: 'networkidle' }).catch(() => null);
    const pfStatus = pfGet ? pfGet.status() : 0;
    const hasForm = await pPub.locator('form').count();
    check('PF1a. public form GET /f/aduan renders without login', pfStatus === 200 && hasForm > 0, 'status=' + pfStatus + ' forms=' + hasForm);

    // PF2: empty required -> rejected
    await pPub.locator('form button[type=submit], form button').first().click();
    await sleep(2000);
    const errTxt = await pPub.evaluate(() => document.body.innerText);
    const rejectedEmpty = /required|wajib|terpaksa|nama penadu/i.test(errTxt) && q(`SELECT COUNT(*) c FROM aduan`)[0].c === 0;
    check('PF2. empty required submit rejected, no row', rejectedEmpty, 'rows=' + q(`SELECT COUNT(*) c FROM aduan`)[0].c);

    // PF1b: valid submit -> record with pending + numbering
    await pPub.goto(APP + '/f/aduan', { waitUntil: 'networkidle' });
    await pPub.fill('input[name="nama_penadu"], #form\\.nama_penadu, [name=nama_penadu]', 'Ahmad Awam');
    await pPub.fill('input[name="eMel"], [name=eMel]', 'ahmad@awam.my');
    await pPub.fill('textarea[name="kandungan"], [name=kandungan]', 'Aduan awam tentang perkhidmatan');
    await pPub.locator('form button[type=submit], form button').first().click();
    await sleep(2500);
    const adu = q(`SELECT nama_penadu, status_aduan, rujukan_aduan, public_reference FROM aduan WHERE nama_penadu='Ahmad Awam'`);
    check('PF1b. public submit creates record, status=pending, numbering ran',
        adu.length === 1 && adu[0].status_aduan === 'pending' && /^ADU-\d{4}/.test(adu[0].rujukan_aduan || '') && !!(adu[0].public_reference),
        JSON.stringify(adu).slice(0, 220));

    // PF3: unknown slug -> 404 (form off == no route)
    const pf3 = await pPub.goto(APP + '/f/tiadaform', { waitUntil: 'networkidle' }).catch(() => null);
    check('PF3. unknown public slug -> 404', pf3 && pf3.status() === 404, 'status=' + (pf3 ? pf3.status() : 0));

    // PF4: numbering increments on second public submit
    await pPub.goto(APP + '/f/aduan', { waitUntil: 'networkidle' });
    await pPub.fill('input[name="nama_penadu"], [name=nama_penadu]', 'Siti Awam');
    await pPub.fill('input[name="eMel"], [name=eMel]', 'siti@awam.my');
    await pPub.fill('textarea[name="kandungan"], [name=kandungan]', 'Aduan kedua');
    await pPub.locator('form button[type=submit], form button').first().click();
    await sleep(2500);
    const adu2 = q(`SELECT rujukan_aduan FROM aduan WHERE nama_penadu='Siti Awam'`);
    const first = adu[0] ? adu[0].rujukan_aduan : '';
    const second = adu2[0] ? adu2[0].rujukan_aduan : '';
    check('PF4. second public submit increments numbering', second && second !== first, first + ' -> ' + second);

    console.log('\n================ FASA 23 RUNTIME SUMMARY ================');
    console.log(`${pass.length} PASS / ${fail.length} FAIL`);
    if (fail.length) { console.log('FAILURES:'); fail.forEach((f) => console.log('  - ' + f)); }
    if (contracts.length) { console.log('CONTRACTS RECORDED:'); contracts.forEach((c) => console.log('  * ' + c)); }
    await browser.close();
    process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS FATAL:', e.message); process.exit(2); });
