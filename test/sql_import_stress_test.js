// SQL import stress test: kitchen-sink schema covering every relationship
// shape Fixzy SysMaker supports. Runs the REAL import pipeline (same IPC
// handler the GUI uses) against an isolated store, then feeds the imported
// schema through the full generator set and php -l.
//
// Coverage: 1:1 (unique FK), 1:N, M:N junctions, self-reference,
// composite PK/FK, composite unique/index, all numeric types, unsigned,
// zerofill, decimal scale, text family, timestamps, defaults, ON DELETE /
// ON UPDATE variants, backticks, ENGINE clauses.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.FSM_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fixzy_sqlimp_'));

const { openStore } = require('../src/core/store');
const { createWebServer } = require('../src/core/webServer');

let pass = 0, fail = 0;
function check(name, cond, extra) {
    if (cond) { pass++; console.log('PASS  ' + name); }
    else { fail++; console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}

const SQL_FILE = path.join(__dirname, 'fixtures', 'sql_import_kitchen_sink.sql');

(async () => {
    const db = openStore();
    const srv = createWebServer({ db, port: 7799 });
    const ipc = srv.ipc;

    // 1. create project
    const created = await ipc.invoke('project:create', 'SQL Import Stress');
    const projectId = created && (created.projectId || created.project_id || created.id);
    check('1. project created', !!projectId, JSON.stringify(created).slice(0, 120));

    // 2. import kitchen-sink SQL through the real handler
    const sql = fs.readFileSync(SQL_FILE, 'utf8');
    const res = await ipc.invoke('sql:import-text', { sql, projectId, dialect: 'MySQL' });
    check('2. import success', res && res.success === true, res && res.message);
    check('3. 11 tables imported', /imported 11 tables/.test(res.message || ''), res.message);
    check('4. 14 relationships imported', /14 relationships/.test(res.message || ''), res.message);

    // 3. pull the full schema back out
    const full = await ipc.invoke('project:get-full-schema', projectId);
    const tables = full.database.table;
    const rels = full.database.relationships || [];
    // project:create auto-adds a 'users' table, so 11 imported + 1 = 12
    check('5. schema has 12 tables (11 imported + users)', Object.keys(tables).length === 12, String(Object.keys(tables).length));
    check('6. schema has 14 relationships', rels.length === 14, String(rels.length));

    // 4. relationship shapes
    const byChildParent = (c, p) => rels.find(r =>
        (r.child_table_name || r.child_table) === c && (r.parent_table_name || r.parent_table) === p);
    const t11 = byChildParent('staff_profiles', 'staff');
    check('7. staff_profiles->staff is one-to-one', t11 && t11.relationship_type === 'one-to-one', t11 && t11.relationship_type);
    const coord = rels.find(r => r.fk_child_field === 'coordinator_staff_no');
    check('8. courses.coordinator->staff is one-to-one', coord && coord.relationship_type === 'one-to-one', coord && coord.relationship_type);
    const selfRef = byChildParent('staff', 'staff');
    check('9. staff self-reference (supervisor) detected', !!selfRef && selfRef.fk_child_field === 'supervisor_id');
    const mn1 = byChildParent('enrollments', 'students');
    const mn2 = byChildParent('enrollments', 'courses');
    check('10. enrollments M:N both sides', !!mn1 && !!mn2);
    const prereq = rels.filter(r => (r.child_table_name || r.child_table) === 'prerequisites' && (r.parent_table_name || r.parent_table) === 'courses');
    check('11. prerequisites two FKs to courses', prereq.length === 2, String(prereq.length));

    // 5. referential actions preserved
    const staffDept = byChildParent('staff', 'departments');
    check('12. staff->dept ON DELETE RESTRICT', staffDept && String(staffDept.on_delete).toUpperCase() === 'RESTRICT', staffDept && staffDept.on_delete);
    check('13. staff->dept ON UPDATE CASCADE', staffDept && String(staffDept.on_update).toUpperCase() === 'CASCADE', staffDept && staffDept.on_update);
    const staffLoc = byChildParent('staff', 'locations');
    check('14. staff->location ON DELETE SET NULL', staffLoc && String(staffLoc.on_delete).toUpperCase() === 'SET NULL', staffLoc && staffLoc.on_delete);
    const audit = byChildParent('audit_log', 'staff');
    check('15. audit->staff ON DELETE NO ACTION', audit && String(audit.on_delete).toUpperCase() === 'NO ACTION', audit && audit.on_delete);

    // 6. data type normalization
    const staffF = tables.staff.fields;
    check('16. staff_no auto_increment', staffF.staff_no.auto_increment == 1);
    check('17. salary DECIMAL unsigned kept', /DECIMAL/i.test(staffF.salary.data_type) && staffF.salary.unsigned == 1, staffF.salary.data_type + ' u=' + staffF.salary.unsigned);
    check('18. bio TEXT tv_wrap', tables.staff.fields.bio.tv_wrap_text == 1 || staffF.bio.tv_wrap_text == 1);
    const logF = tables.audit_log.fields;
    check('19. log_id BIGINT zerofill', /BIGINT/i.test(logF.log_id.data_type) && logF.log_id.zero_fill == 1, logF.log_id.data_type + ' zf=' + logF.log_id.zero_fill);
    const locF = tables.locations.fields;
    check('20. geo_lat DOUBLE', /DOUBLE/i.test(locF.geo_lat.data_type), locF.geo_lat.data_type);

    // 7. constraints (composite)
    const cons = db.prepare('SELECT constraint_name, constraint_type, columns FROM table_constraints').all();
    const allCons = JSON.stringify(cons);
    check('21. composite unique campus+building stored', allCons.includes('uq_campus_building'), allCons.slice(0, 150));
    check('22. composite index location+joined stored', allCons.includes('idx_staff_loc_join'));
    check('23. composite unique enroll triple stored', allCons.includes('uq_enroll'));

    // 8. lookup wiring on FK fields
    check('24. enrollments.student_id lookup wired', staffF && tables.enrollments.fields.student_id.lookup_parent_table === 'students', tables.enrollments.fields.student_id.lookup_parent_table);
    check('25. lookup caption is a text field', !!tables.enrollments.fields.student_id.lookup_caption_1, tables.enrollments.fields.student_id.lookup_caption_1);

    // 9. menu items auto-created per table
    const menuCount = db.prepare('SELECT COUNT(*) c FROM menu_items WHERE project_id = ?').get(projectId).c;
    check('26. 12 menu items created (11 + users)', menuCount === 12, String(menuCount));

    // 10. standardization log (system fields added)
    check('27. standardization log present', /standardization/i.test(res.message || ''));

    // 11. run the FULL generator set on the imported schema (no throws)
    const outDir = path.join(process.env.FSM_DATA_DIR, 'gen');
    fs.mkdirSync(outDir, { recursive: true });
    const gens = [
        ['AdminPanelProvider', () => require('../src/generators/laravelAdminPanelGenerator').generateAdminPanelProvider(full, outDir)],
        ['FilamentModels', () => require('../src/generators/laravelDatabaseGenerator').generateFilamentModels(full, outDir)],
        ['LaravelMigrations', () => require('../src/generators/laravelDatabaseGenerator').generateLaravelMigrations(full, outDir)],
        ['FilamentResources', () => require('../src/generators/laravelResourceGenerator').generateFilamentResources(full, outDir)],
        ['FilamentTables', () => require('../src/generators/laravelTablesGenerator').generateFilamentTablesTable(full, outDir)],
        ['FilamentSchemasForm', () => require('../src/generators/laravelSchemasGenerator').generateFilamentSchemasForm(full, outDir)],
        ['RelationManagers', () => require('../src/generators/laravelRelationManagersGenerator').generateFilamentRelationManagers(full, outDir)],
    ];
    let genFails = [];
    for (const [name, fn] of gens) {
        try { await fn(); console.log('OK   generator ' + name); }
        catch (e) { genFails.push(name + ': ' + String(e.message).slice(0, 140)); }
    }
    check('28. all generators ran without throwing', genFails.length === 0, genFails.join(' | '));

    // 12. php -l on every generated php file
    function walk(dir, out = []) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p, out); else if (p.endsWith('.php')) out.push(p);
        }
        return out;
    }
    const phpFiles = walk(outDir);
    let phpFails = [];
    const { execFileSync } = require('child_process');
    let phpBin = 'php';
    try { execFileSync('php', ['--version']); } catch { phpBin = path.join(__dirname, '..', 'bin', 'php-8.4.12', 'php'); }
    for (const f of phpFiles) {
        try { execFileSync(phpBin, ['-l', f], { stdio: 'pipe' }); }
        catch (e) { phpFails.push(path.basename(f) + ': ' + String(e.stdout || e.message).slice(0, 120)); }
    }
    check('29. php -l clean on ' + phpFiles.length + ' generated files', phpFiles.length > 20 && phpFails.length === 0, phpFails.slice(0, 3).join(' | '));

    console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
    try { srv.server.close(); } catch {}
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
