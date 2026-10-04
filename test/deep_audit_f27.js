/**
 * Fasa 27 — data integrity across versions + IR round-trip.
 *
 * U1: open a PRE-AUDIT store (schema from 1dad5d67d~1, before approval/
 *     numbering/kanban columns existed) with the CURRENT store code ->
 *     incremental ALTERs add every missing column, legacy rows intact.
 * U2: IR export -> adapter -> generate -> byte-diff vs generate from the
 *     original fullSchema == 0.
 * U3: (covered by existing sql_import_stress_test.js — re-run as gate)
 * U4: all-features project generates with no orphan/feature clash.
 *
 * Usage: node test/deep_audit_f27.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const REPO = path.join(__dirname, '..');
const pass = []; const fail = []; const contracts = [];
function check(name, ok, detail) {
    (ok ? pass : fail).push(name);
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  [' + String(detail).slice(0, 220) + ']' : ''));
}
function note(t) { contracts.push(t); console.log('NOTE  ' + t); }

(async () => {
    const { openStore } = require('../src/core/store');
    const ANCIENT_DB = '/tmp/fsm27_ancient.db';

    // ---- U1: build an ancient store, then open with current code --------
    fs.rmSync(ANCIENT_DB, { force: true });
    fs.rmSync(ANCIENT_DB + '-wal', { force: true });
    fs.rmSync(ANCIENT_DB + '-shm', { force: true });
    execSync(`sqlite3 ${ANCIENT_DB} < /tmp/schema_ancient.sql`);

    // Seed legacy data BEFORE opening with the current store.
    execSync(`sqlite3 ${ANCIENT_DB} "
        INSERT INTO projects (app_title, language_select, timezone_select) VALUES ('LegacyProj','English','Asia/Kuala_Lumpur');
        INSERT INTO tables (table_name, project_id, table_view_title) VALUES ('pelajar', 1, 'Pelajar');
        INSERT INTO fields (field_name, table_id, caption, data_type) VALUES ('nama', 1, 'Nama', 'VARCHAR');
        INSERT INTO fields (field_name, table_id, caption, data_type) VALUES ('umur', 1, 'Umur', 'INT');
    "`);
    const beforeCols = execSync(`sqlite3 ${ANCIENT_DB} "SELECT COUNT(*) FROM pragma_table_info('tables')"`, { encoding: 'utf8' }).trim();

    // Open with CURRENT store code -> incremental migrations run.
    const db = openStore(ANCIENT_DB);
    const afterCols = db.prepare("PRAGMA table_info(tables)").all().map((c) => c.name);
    const projCols = db.prepare("PRAGMA table_info(projects)").all().map((c) => c.name);
    const fieldCols = db.prepare("PRAGMA table_info(fields)").all().map((c) => c.name);

    const mustHaveTables = ['approval_enabled', 'approval_config', 'numbering_enabled', 'numbering_config',
        'grid_kanban_enabled', 'grid_kanban_config', 'import_enabled', 'api_enabled',
        'public_form_enabled', 'attachments_enabled', 'scheduler_config'];
    const missingT = mustHaveTables.filter((c) => !afterCols.includes(c));
    check('U1a. store migration adds all new tables-columns', missingT.length === 0, 'missing=' + missingT.join(','));
    const mustHaveProj = ['module_realtime', 'module_scheduler', 'auth_2fa_mode', 'backup_config'];
    const missingP = mustHaveProj.filter((c) => !projCols.includes(c));
    check('U1b. store migration adds all new projects-columns', missingP.length === 0, 'missing=' + missingP.join(','));
    check('U1c. fields table migrated (visible_if etc.)', fieldCols.includes('visible_if') && fieldCols.includes('form_group'));

    // Legacy data intact?
    const legacy = db.prepare("SELECT app_title FROM projects WHERE project_id=1").get();
    const legacyTables = db.prepare("SELECT table_name FROM tables WHERE project_id=1").all().map((r) => r.table_name);
    const legacyFields = db.prepare("SELECT field_name FROM fields WHERE table_id=1").all().map((r) => r.field_name);
    check('U1d. legacy project/tables/fields rows intact',
        legacy && legacy.app_title === 'LegacyProj' && legacyTables.join() === 'pelajar' && legacyFields.join() === 'nama,umur',
        `${legacy && legacy.app_title} | ${legacyTables.join()} | ${legacyFields.join()}`);
    // New columns default sanely on legacy rows (not NULL chaos)
    const sane = db.prepare("SELECT approval_enabled, numbering_enabled, grid_kanban_enabled FROM tables WHERE table_id=1").get();
    check('U1e. new columns have sane defaults on legacy rows',
        sane.approval_enabled === 0 && sane.numbering_enabled === 0 && sane.grid_kanban_enabled === 0,
        JSON.stringify(sane));

    // ---- U1 spot-check: generate from the migrated store -----------------
    // Manual assembly mirroring project:get-full-schema essentials.
    const project = db.prepare('SELECT * FROM projects WHERE project_id=1').get();
    const tables = {};
    for (const t of db.prepare('SELECT * FROM tables WHERE project_id=1').all()) {
        const fields = {};
        for (const f of db.prepare('SELECT * FROM fields WHERE table_id=?').all(t.table_id)) fields[f.field_name] = f;
        tables[t.table_name] = { ...t, fields };
    }
    const fullSchema = { project, database: { table: tables, relationships: [], unified_menu: [] } };
    const outDir = '/tmp/fsm27_gen_migrated';
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');
    const gen = await generateLaravelFilamentStack(fullSchema, outDir);
    check('U1f. generate from migrated legacy store succeeds', gen.success === true, (gen.message || '').slice(0, 150));
    const modelFile = path.join(outDir, 'app', 'Models', 'Pelajar.php');
    check('U1g. legacy model generated with legacy fields',
        fs.existsSync(modelFile) && fs.readFileSync(modelFile, 'utf8').includes('nama') && fs.readFileSync(modelFile, 'utf8').includes('umur'));

    // ---- U2: IR round-trip byte-diff ------------------------------------
    const { exportIR } = require('../src/ir/exporter');
    const { asLegacyFullSchema } = require('../src/ir/adapter');
    const ir = exportIR(fullSchema);
    const roundSchema = asLegacyFullSchema(ir);
    const outDir2 = '/tmp/fsm27_gen_ir';
    fs.rmSync(outDir2, { recursive: true, force: true });
    fs.mkdirSync(outDir2, { recursive: true });
    const gen2 = await generateLaravelFilamentStack(roundSchema, outDir2);
    check('U2a. generate from IR round-trip schema succeeds', gen2.success === true, (gen2.message || '').slice(0, 150));
    // byte-diff the two generated trees
    let diffOut = '';
    try {
        diffOut = execSync(`diff -rq ${outDir} ${outDir2} 2>&1 || true`, { encoding: 'utf8' }).trim();
    } catch (e) { diffOut = 'diff error: ' + e.message; }
    check('U2b. IR round-trip generate == original generate (byte-diff 0)', diffOut === '', diffOut.split('\n').slice(0, 4).join(' | '));

    db.close();

    console.log('\n================ FASA 27 SUMMARY ================');
    console.log(`${pass.length} PASS / ${fail.length} FAIL`);
    if (fail.length) { console.log('FAILURES:'); fail.forEach((f) => console.log('  - ' + f)); }
    if (contracts.length) { console.log('CONTRACTS RECORDED:'); contracts.forEach((c) => console.log('  * ' + c)); }
    process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS FATAL:', e.message); process.exit(2); });
