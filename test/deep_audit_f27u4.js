/**
 * Fasa 27 U4 — all-features project: generate, no orphan files / feature clash.
 * Uses the DEEP-AUDIT-001 store (17 tables: numbering, approval, kanban,
 * calendar, tree, soft delete, attachments, public form, scoping, hooks).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const pass = []; const fail = [];
function check(name, ok, detail) {
    (ok ? pass : fail).push(name);
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  [' + String(detail).slice(0, 220) + ']' : ''));
}

(async () => {
    const { openStore } = require('../src/core/store');
    const db = openStore('/tmp/fsm-deep-store/Fixzy SysMaker.db');
    const project = db.prepare('SELECT * FROM projects WHERE is_active=1 LIMIT 1').get()
        || db.prepare('SELECT * FROM projects LIMIT 1').get();
    const tables = {};
    for (const t of db.prepare('SELECT * FROM tables WHERE project_id=?').all(project.project_id)) {
        const fields = {};
        for (const f of db.prepare('SELECT * FROM fields WHERE table_id=?').all(t.table_id)) fields[f.field_name] = f;
        tables[t.table_name] = { ...t, fields };
    }
    const nameById = {};
    for (const t of Object.values(tables)) nameById[t.table_id] = t.table_name;
    const rels = db.prepare('SELECT * FROM parent_child_relationships').all().map((r) => ({
        ...r,
        parent_table_name: nameById[r.parent_table_id] || '',
        child_table_name: nameById[r.child_table_id] || '',
    }));
    const fullSchema = { project, database: { table: tables, relationships: rels, unified_menu: [] } };
    db.close();

    const out = '/tmp/fsm27_gen_allfeat';
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');
    const gen = await generateLaravelFilamentStack(fullSchema, out);
    check('U4a. all-features project generates', gen.success === true, (gen.message || '').slice(0, 150));

    // php -l every file
    const files = execSync(`find ${out} -name '*.php'`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    let lintBad = [];
    for (const f of files) {
        const r = spawnSync('php', ['-l', f], { encoding: 'utf8' });
        if (r.status !== 0) lintBad.push(f.replace(out + '/', ''));
    }
    check('U4b. all generated PHP lint-clean', lintBad.length === 0, lintBad.slice(0, 3).join(' | '));

    // duplicate class names across the tree (feature clash detector)
    const classNames = {};
    for (const f of files) {
        const txt = fs.readFileSync(f, 'utf8');
        const ns = (txt.match(/^namespace\s+([A-Za-z0-9_\\]+)/m) || [, ''])[1];
        const m = txt.match(/^class\s+([A-Za-z0-9_]+)/m);
        if (m) {
            // PHP identity = namespace + class name (same short name in
            // different namespaces is NOT a clash).
            const key = ns + '\\' + m[1];
            (classNames[key] = classNames[key] || []).push(f.replace(out + '/', ''));
        }
    }
    const dups = Object.entries(classNames).filter(([, v]) => v.length > 1);
    check('U4c. no duplicate class names (feature clash)', dups.length === 0,
        dups.slice(0, 3).map(([k, v]) => k + ':' + v.join(',')).join(' | '));

    // orphan check: every Filament Resource dir has its Resource class file
    const resRoot = path.join(out, 'app', 'Filament', 'Resources');
    let orphans = [];
    if (fs.existsSync(resRoot)) {
        for (const d of fs.readdirSync(resRoot)) {
            const full = path.join(resRoot, d);
            if (!fs.statSync(full).isDirectory()) continue;
            // The resource class file name follows pluralize.singular() which
            // is not a naive 's'-strip (dokumen->dokuman, kursuses->kursus).
            // Contract: the dir must contain exactly one *Resource.php.
            const resFiles = fs.readdirSync(full).filter((x) => x.endsWith('Resource.php'));
            if (resFiles.length !== 1) orphans.push(d + ' (found ' + resFiles.length + ' *Resource.php)');
        }
    }
    check('U4d. no orphan resource dirs', orphans.length === 0, orphans.slice(0, 3).join(' | '));

    console.log('\n================ FASA 27 U4 SUMMARY ================');
    console.log(`${pass.length} PASS / ${fail.length} FAIL`);
    if (fail.length) { console.log('FAILURES:'); fail.forEach((f) => console.log('  - ' + f)); }
    process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS FATAL:', e.message); process.exit(2); });
