// End-to-end test: Google Sheets two-way sync against a MOCK Google API.
//
// Proves the generated sync engine actually works without touching real
// Google servers:
//   1. generate google_sheets_on fixture -> overlay on preview_env
//   2. boot mock Sheets API (php -S) + fake service account (token_uri
//      points at the mock)
//   3. createSheetFor() -> spreadsheet created, header+rows pushed,
//      share email permission recorded
//   4. sheet edit (simulated via mock state) -> pullFromSheet() updates DB
//   5. new sheet row (empty uuid) -> imported with generated sync_uuid
//   6. DB edit after last sync -> conflict guard SKIPS the sheet value
//   7. pushRecord('delete') -> row removed from mock sheet
//   8. echo-loop guard: pull does not re-push (write count stable)
//
// Usage: node test/gsheets_e2e.js
// Requires: system php (pdo_sqlite), resources/preview_env vendor.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawn } = require('child_process');

const REPO = path.join(__dirname, '..');
const MOCK_PORT = 8788;
const MOCK_BASE = `http://127.0.0.1:${MOCK_PORT}`;

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-gsheets-'));
const genDir = path.join(work, 'gen');
const appDir = path.join(work, 'app');
const stateFile = path.join(work, 'mock_state.json');
fs.mkdirSync(genDir, { recursive: true });

let failures = 0;
function check(name, cond, detail = '') {
    if (cond) {
        console.log(`  OK   ${name}`);
    } else {
        failures++;
        console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
    }
}

function run(cmd, opts = {}) {
    return execSync(cmd, { encoding: 'utf8', cwd: work, ...opts });
}

// Run a PHP snippet inside the generated app (artisan tinker style).
function php(bootstrap, code) {
    const script = path.join(work, 'snippet.php');
    fs.writeFileSync(script, `<?php
require '${appDir}/vendor/autoload.php';
$app = require_once '${appDir}/bootstrap/app.php';
$app->make('Illuminate\\Contracts\\Console\\Kernel')->bootstrap();
${code}
`);
    try {
        return execSync(`php ${script} 2>&1`, { encoding: 'utf8', cwd: work }).trim();
    } catch (e) {
        throw new Error(`php snippet failed: ${e.stdout || ''}${e.stderr || ''}`.slice(0, 2000));
    }
}

function mockState() {
    if (!fs.existsSync(stateFile)) return { spreadsheets: {}, permissions: [], request_log: [] };
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
}
function writeMockState(s) {
    fs.writeFileSync(stateFile, JSON.stringify(s, null, 2));
}

let mockProc = null;
function startMock() {
    mockProc = spawn('php', ['-S', `127.0.0.1:${MOCK_PORT}`, path.join(REPO, 'test', 'mocks', 'gsheets_mock.php')], {
        cwd: REPO,
        env: { ...process.env, GSHEETS_MOCK_STATE: stateFile },
        stdio: ['ignore', 'ignore', 'pipe'],
    });
    // Wait until the token endpoint answers.
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        try {
            const out = execSync(
                `curl -s -o /dev/null -w "%{http_code}" -X POST ${MOCK_BASE}/token`,
                { encoding: 'utf8', timeout: 2000 }
            );
            if (out.trim() === '200') return;
        } catch (e) { /* not up yet */ }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
    throw new Error('mock Sheets API did not start');
}

(async () => {
    // 1. Generate from the google_sheets_on fixture.
    const schema = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'fixtures', 'google_sheets_on.json'), 'utf8'));
    const fullSchema = {
        project: schema.project,
        database: {
            name: schema.database.name,
            table: schema.database.table || {},
            relationships: schema.database.relationships || [],
            unified_menu: schema.database.unified_menu || [],
        },
    };
    const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');
    const res = await generateLaravelFilamentStack(fullSchema, genDir);
    if (!res.success) throw new Error(`generate failed: ${res.message}`);
    console.log('generated OK');

    // 2. Overlay onto a fresh skeleton copy.
    run(`cp -a ${path.join(REPO, 'resources/preview_env')} ${appDir}`);
    if (!fs.existsSync(path.join(appDir, '.env'))) {
        fs.copyFileSync(path.join(appDir, '.env.example'), path.join(appDir, '.env'));
    }
    run(`php ${path.join(appDir, 'artisan')} key:generate --force -q`, { cwd: appDir });
    run(`cp -a ${genDir}/. ${appDir}/`);
    // Register manifest providers (mirrors deploymentHandler).
    const manifest = JSON.parse(fs.readFileSync(path.join(genDir, 'fixzy-manifest.json'), 'utf8'));
    const providersFile = path.join(appDir, 'bootstrap', 'providers.php');
    let provContents = fs.readFileSync(providersFile, 'utf8');
    for (const prov of manifest.providers || []) {
        if (!provContents.includes(prov.split('\\').pop())) {
            provContents = provContents.replace(/return\s*\[/, `return [\n    ${prov}::class,`);
        }
    }
    fs.writeFileSync(providersFile, provContents);
    console.log('skeleton + overlay + providers ready');

    // 3. Migrate.
    run(`php ${path.join(appDir, 'artisan')} migrate:fresh --seed --force -q`, { cwd: appDir });
    run(`rm -rf ${path.join(appDir, 'bootstrap/cache/filament')}`);
    console.log('migrated');

    // 4. Fake service account JSON pointing token_uri at the mock.
    const fakeKey = {
        type: 'service_account',
        project_id: 'mock-project',
        private_key_id: 'mockkey1',
        private_key: (() => {
            // Generate a throwaway RSA key with openssl (test-only).
            const pem = execSync('openssl genrsa 2048 2>/dev/null', { encoding: 'utf8' });
            return pem;
        })(),
        client_email: 'mock-sa@mock-project.iam.gserviceaccount.com',
        client_id: '1234567890',
        token_uri: `${MOCK_BASE}/token`,
    };
    const saPath = path.join(appDir, 'storage', 'app', 'private', 'google_service_account.json');
    fs.mkdirSync(path.dirname(saPath), { recursive: true });
    fs.writeFileSync(saPath, JSON.stringify(fakeKey, null, 2));

    startMock();
    console.log('mock Sheets API up on', MOCK_BASE);

    // Configure settings: credentials + share email + base_uri override.
    php('', `
\\App\\Models\\FixzySetting::set('gsheets_service_account_path', 'google_service_account.json');
\\App\\Models\\FixzySetting::set('gsheets_share_email', 'admin@example.com');
\\App\\Models\\FixzySetting::set('gsheets_base_uri', '${MOCK_BASE}');
`);
    check('credentials configured', php('', `echo \\App\\Services\\GoogleSheets\\GoogleSheetsSyncService::credentialsConfigured() ? 'yes' : 'no';`) === 'yes');

    // Seed a couple of DB rows (Pelajar is a synced custom table).
    // Clear the preview_env faker rows first so counts are deterministic.
    php('', `
\\Illuminate\\Support\\Facades\\DB::statement('PRAGMA foreign_keys = OFF');
\\App\\Models\\ProfilPelajar::query()->forceDelete();
\\App\\Models\\Pelajar::query()->forceDelete();
\\Illuminate\\Support\\Facades\\DB::statement('PRAGMA foreign_keys = ON');
$p1 = new \\App\\Models\\Pelajar();
$p1->forceFill(['fakulti_id' => 1, 'nama_penuh' => 'Ali Bin Abu', 'no_matrik' => 'M001', 'email' => ['ali@example.com'], 'tarikh_daftar' => '2026-01-10'])->save();
$p2 = new \\App\\Models\\Pelajar();
$p2->forceFill(['fakulti_id' => 1, 'nama_penuh' => 'Siti Binti Ahmad', 'no_matrik' => 'M002', 'email' => ['siti@example.com'], 'tarikh_daftar' => '2026-02-15'])->save();
echo \\App\\Models\\Pelajar::count();
`);
    const seedCount = php('', `echo \\App\\Models\\Pelajar::count();`);
    check('db seeded', seedCount === '2', 'got: ' + seedCount);

    // 5. createSheetFor('Pelajar') — the "Create Google Sheet" button path.
    const createOut = php('', `
try {
    $svc = new \\App\\Services\\GoogleSheets\\GoogleSheetsSyncService();
    $m = $svc->createSheetFor('Pelajar');
    echo json_encode(['ss' => $m->spreadsheet_id, 'sheet' => $m->sheet_name, 'synced_at' => (string) $m->last_synced_at]);
} catch (\\Throwable $e) {
    echo 'THROWN:' . get_class($e) . ': ' . $e->getMessage() . ' @' . $e->getFile() . ':' . $e->getLine();
}
`);
    if (createOut.startsWith('THROWN:')) {
        throw new Error('createSheetFor failed: ' + createOut);
    }
    const created = JSON.parse(createOut);
    check('sheet created', !!created.ss, createOut);
    let st = mockState();
    const ss = st.spreadsheets[created.ss];
    check('mock has spreadsheet', !!ss);
    const sheetRows = ss.values['Sheet1'] || [];
    check('header row pushed', sheetRows[0] && sheetRows[0][0] === 'sync_uuid' && sheetRows[0][1] === 'Id Fakulti', JSON.stringify(sheetRows[0]));
    check('2 data rows pushed', sheetRows.length === 3, `rows=${sheetRows.length}`);
    check('share permission recorded', st.permissions.some((p) => p.emailAddress === 'admin@example.com' && p.role === 'writer'));
    check('rows got sync_uuid', php('', `echo \\App\\Models\\Pelajar::whereNotNull('sync_uuid')->count();`) === '2');

    const aliUuid = php('', `echo \\App\\Models\\Pelajar::where('no_matrik','M001')->value('sync_uuid');`);

    // 6. Simulate a sheet edit by the user (change nama_penuh of M001 row),
    //    then pull -> DB should update. Also create the ProfilPelajar sheet
    //    and add a brand-new row (empty uuid) there -> imported with a
    //    generated sync_uuid. (Pelajar is not used for the new-row case
    //    because its NOT NULL repeater column 'email' is not part of the
    //    sheet — that row must be SKIPPED, not crash the pull.)
    php('', `
$svc = new \\App\\Services\\GoogleSheets\\GoogleSheetsSyncService();
$m2 = $svc->createSheetFor('ProfilPelajar');
echo $m2->spreadsheet_id;
`);
    st = mockState();
    const ppId = Object.keys(st.spreadsheets).find((k) => st.spreadsheets[k].properties.title === 'Profil Pelajar (Fixzy Sync)');
    check('second sheet created (ProfilPelajar)', !!ppId);
    st = mockState();
    const aliRowIdx = st.spreadsheets[created.ss].values['Sheet1'].findIndex((r) => (r[0] || '') === aliUuid);
    st.spreadsheets[created.ss].values['Sheet1'][aliRowIdx][2] = 'Ali Bin Abu (edited in sheet)';
    // New row in the ProfilPelajar sheet (columns: sync_uuid, Pelajar Id, Alamat, No Telefon, Tarikh Lahir, Info Kecemasan).
    // Use the REAL id of M001 (faker reseeds shift autoincrement ids).
    const aliId = php('', `echo \\App\\Models\\Pelajar::where('no_matrik','M001')->value('id');`);
    st.spreadsheets[ppId].values['Sheet1'].push(['', aliId, 'Jalan Baharu 123', '0123456789', '2004-05-05', 'Kecemasan A']);
    writeMockState(st);

    const pullOut = php('', `
$svc = new \\App\\Services\\GoogleSheets\\GoogleSheetsSyncService();
echo json_encode($svc->pullFromSheet('Pelajar'));
`);
    const pullPP = php('', `
$svc = new \\App\\Services\\GoogleSheets\\GoogleSheetsSyncService();
echo json_encode($svc->pullFromSheet('ProfilPelajar'));
`);
    const pull = JSON.parse(pullOut);
    const pull2pp = JSON.parse(pullPP);
    check('pull updated 1 edited row (Pelajar)', pull.updated === 1, pullOut);
    check('pull imported 1 new sheet row (ProfilPelajar)', pull2pp.imported === 1, pullPP);
    check('DB reflects sheet edit', php('', `echo \\App\\Models\\Pelajar::where('no_matrik','M001')->value('nama_penuh');`) === 'Ali Bin Abu (edited in sheet)');
    check('new sheet row in DB with uuid', php('', `echo \\App\\Models\\ProfilPelajar::where('alamat','Jalan Baharu 123')->whereNotNull('sync_uuid')->count();`) === '1');

    // 7. Conflict guard: edit DB AFTER last sync, then pull -> sheet value
    //    must NOT overwrite the fresher DB value.
    php('', `
$row = \\App\\Models\\Pelajar::where('no_matrik','M002')->first();
$row->nama_penuh = 'Siti (DB wins)';
$row->save();
`);
    st = mockState();
    const sitiIdx = st.spreadsheets[created.ss].values['Sheet1'].findIndex((r) => (r[3] || '') === 'M002');
    st.spreadsheets[created.ss].values['Sheet1'][sitiIdx][2] = 'Siti (stale sheet value)';
    writeMockState(st);

    const pull2 = JSON.parse(php('', `
$svc = new \\App\\Services\\GoogleSheets\\GoogleSheetsSyncService();
echo json_encode($svc->pullFromSheet('Pelajar'));
`));
    check('conflict: fresher DB skipped', pull2.skipped >= 1, JSON.stringify(pull2));
    check('conflict: DB value preserved', php('', `echo \\App\\Models\\Pelajar::where('no_matrik','M002')->value('nama_penuh');`) === 'Siti (DB wins)');

    // 8. pushRecord delete: DB delete removes the sheet row.
    const before = mockState().spreadsheets[ppId].values['Sheet1'].length;
    php('', `
$svc = new \\App\\Services\\GoogleSheets\\GoogleSheetsSyncService();
$row = \\App\\Models\\ProfilPelajar::where('alamat','Jalan Baharu 123')->first();
$svc->pushRecord('ProfilPelajar', $row, 'delete');
$row->delete();
`);
    const after = mockState().spreadsheets[ppId].values['Sheet1'].length;
    check('delete removed sheet row', after === before - 1, `before=${before} after=${after}`);

    // 9. Echo-loop guard: a pull must not trigger pushes. Count PUT/POST
    //    value writes during a no-op pull.
    const logBefore = mockState().request_log.length;
    php('', `
$svc = new \\App\\Services\\GoogleSheets\\GoogleSheetsSyncService();
$svc->pullFromSheet('Pelajar');
`);
    const newLog = mockState().request_log.slice(logBefore);
    const writes = newLog.filter((r) => r.startsWith('PUT') || r.includes(':append') || r.includes(':batchUpdate'));
    check('pull performs no sheet writes (no echo)', writes.length === 0, JSON.stringify(writes));

    // 10. Observer push path: create via model with sheet existing ->
    //     observer pushes the new row automatically.
    php('', `
$p = new \\App\\Models\\Pelajar();
$p->forceFill(['fakulti_id' => 1, 'nama_penuh' => 'Observer Push', 'no_matrik' => 'M009', 'email' => ['obs@example.com'], 'tarikh_daftar' => '2026-04-01'])->save();
`);
    const rowsNow = mockState().spreadsheets[created.ss].values['Sheet1'];
    check('observer pushed new row to sheet', rowsNow.some((r) => (r[3] || '') === 'M009'), `rows=${rowsNow.length}`);

    console.log(failures === 0 ? '\nGSHEETS E2E PASS' : `\nGSHEETS E2E FAIL (${failures} failing checks)`);
    if (mockProc) mockProc.kill();
    // /tmp is a small tmpfs here — always clean the ~370MB workdir.
    // KEEP_WORK=1 keeps it for manual debugging.
    if (!process.env.KEEP_WORK) {
        try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { /* best effort */ }
    }
    process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
    console.error('GSHEETS E2E ERROR:', e.message);
    if (mockProc) mockProc.kill();
    if (!process.env.KEEP_WORK) {
        try { fs.rmSync(work, { recursive: true, force: true }); } catch (e2) { /* best effort */ }
    }
    process.exit(1);
});
