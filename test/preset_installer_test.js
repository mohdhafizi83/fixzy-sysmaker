/**
 * Starter Pack installer tests (temp SQLite DB, real schema).
 * Run: node test/preset_installer_test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openStore } = require('../src/core/store');
const { installPreset, checkCollisions, loadBundledPresets, presetSummary } = require('../src/core/presetInstaller');

let passed = 0;
function t(name, fn) {
    try { fn(); passed++; console.log('  PASS ' + name); }
    catch (e) { console.error('  FAIL ' + name + ': ' + e.message); process.exitCode = 1; }
}

function freshDb() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-preset-'));
    const db = openStore(path.join(dir, 'test.db'));
    const pid = db.prepare("INSERT INTO projects (app_title, is_active) VALUES ('Preset Test', 1)").run().lastInsertRowid;
    return { db, pid };
}

const miniManifest = () => ({
    schema_version: 1,
    slug: 'mini-pack',
    name: 'Mini Pack',
    tagline: 'tiny',
    category: 'test',
    tables: [
        { ref: 'cats', table_name: 'cats', module_name: 'Cats', fields: [{ field_name: 'cat_name', field_type: 'VARCHAR', required: 1 }] },
        {
            ref: 'litters', table_name: 'litters', module_name: 'Litters', menu_group: 'Cattery',
            fields: [
                { field_name: 'cat_id', field_type: 'INT', required: 1 },
                { field_name: 'litter_date', field_type: 'DATE' },
                { field_name: 'status', field_type: 'VARCHAR', display_type: 'options_list', options_list_values: 'open|closed' },
            ],
            table_settings: {
                approval_enabled: 1,
                approval_config: {
                    statusField: 'status', initial: 'open',
                    statuses: [
                        { key: 'open', label: 'Open', color: 'warning', final: false },
                        { key: 'closed', label: 'Closed', color: 'success', final: true },
                    ],
                    transitions: [{ from: 'open', to: 'closed', label: 'Close', roles: '', require_comment: false, notify: '' }],
                },
            },
        },
    ],
    relationships: [{ parent_ref: 'cats', child_ref: 'litters', fk_field: 'cat_id' }],
    custom_modules: [
        { ref: 'open_litters', base_table_ref: 'litters', module_name: 'Open Litters', menu_group: 'Cattery',
          settings_override: { table_view_title: 'Open Only' } },
    ],
});

console.log('presetInstaller tests');

t('install creates tables with system + user fields', () => {
    const { db, pid } = freshDb();
    const r = installPreset(db, pid, miniManifest());
    assert.ok(r.success, r.message);
    const cats = db.prepare('SELECT * FROM tables WHERE project_id = ? AND table_name = ?').get(pid, 'cats');
    assert.ok(cats);
    const fields = db.prepare('SELECT field_name FROM fields WHERE table_id = ? ORDER BY field_order').all(cats.table_id).map(f => f.field_name);
    assert.deepStrictEqual(fields, ['id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by', 'cat_name']);
    const idF = db.prepare('SELECT * FROM fields WHERE table_id = ? AND field_name = ?').get(cats.table_id, 'id');
    assert.strictEqual(idF.primary_key, 1);
    assert.strictEqual(idF.auto_increment, 1);
});

t('table_settings applied (approval_config stored as JSON)', () => {
    const { db, pid } = freshDb();
    installPreset(db, pid, miniManifest());
    const lit = db.prepare('SELECT * FROM tables WHERE project_id = ? AND table_name = ?').get(pid, 'litters');
    assert.strictEqual(lit.approval_enabled, 1);
    const cfg = JSON.parse(lit.approval_config);
    assert.strictEqual(cfg.statusField, 'status');
    assert.strictEqual(cfg.statuses.length, 2);
});

t('relationship inserted with resolved ids', () => {
    const { db, pid } = freshDb();
    installPreset(db, pid, miniManifest());
    const rel = db.prepare(`SELECT r.*, p.table_name pt, c.table_name ct
        FROM parent_child_relationships r
        JOIN tables p ON p.table_id = r.parent_table_id
        JOIN tables c ON c.table_id = r.child_table_id`).get();
    assert.strictEqual(rel.pt, 'cats');
    assert.strictEqual(rel.ct, 'litters');
    assert.strictEqual(rel.fk_child_field, 'cat_id');
    assert.strictEqual(rel.parent_field, 'id');
});

t('menu group + items created (table item + module item)', () => {
    const { db, pid } = freshDb();
    installPreset(db, pid, miniManifest());
    const grp = db.prepare('SELECT * FROM menu_groups WHERE project_id = ? AND group_name = ?').get(pid, 'Cattery');
    assert.ok(grp);
    const items = db.prepare('SELECT * FROM menu_items WHERE project_id = ? AND menu_group_id = ? ORDER BY item_order').all(pid, grp.menu_group_id);
    assert.strictEqual(items.length, 2);
    const tableItem = items.find(i => i.table_id && !i.module_id);
    const modItem = items.find(i => i.module_id);
    assert.ok(tableItem && modItem);
    assert.strictEqual(modItem.item_detail, 'Open Litters Custom Module');
});

t('custom module inserted with fields override support', () => {
    const { db, pid } = freshDb();
    const m = miniManifest();
    m.custom_modules[0].fields = [{ field_name: 'status', is_readonly: 1, settings_override: { caption: 'State' } }];
    const r = installPreset(db, pid, m);
    assert.ok(r.success, r.message);
    const mod = db.prepare('SELECT * FROM custom_modules WHERE project_id = ? AND module_name = ?').get(pid, 'Open Litters');
    assert.ok(mod);
    assert.strictEqual(JSON.parse(mod.settings_override).table_view_title, 'Open Only');
    const mf = db.prepare('SELECT * FROM custom_module_fields WHERE module_id = ?').get(mod.module_id);
    assert.strictEqual(mf.is_readonly, 1);
    assert.strictEqual(JSON.parse(mf.settings_override).caption, 'State');
});

t('collision detected: existing table name', () => {
    const { db, pid } = freshDb();
    db.prepare('INSERT INTO tables (project_id, table_name, module_name) VALUES (?, ?, ?)').run(pid, 'cats', 'Cats');
    const r = installPreset(db, pid, miniManifest());
    assert.ok(!r.success);
    assert.ok(r.conflicts && r.conflicts.tables.includes('cats'));
    // No partial writes: litters must NOT exist.
    assert.ok(!db.prepare('SELECT 1 FROM tables WHERE project_id = ? AND table_name = ?').get(pid, 'litters'));
});

t('collision detected: existing module name', () => {
    const { db, pid } = freshDb();
    const catId = db.prepare('INSERT INTO tables (project_id, table_name, module_name) VALUES (?, ?, ?)').run(pid, 'other', 'Other').lastInsertRowid;
    db.prepare('INSERT INTO custom_modules (project_id, table_id, module_name) VALUES (?, ?, ?)').run(pid, catId, 'Open Litters');
    const r = installPreset(db, pid, miniManifest());
    assert.ok(!r.success);
    assert.ok(r.conflicts.modules.includes('Open Litters'));
});

t('invalid manifest never touches DB', () => {
    const { db, pid } = freshDb();
    const m = miniManifest();
    m.tables[0].fields[0].field_type = 'BLOB';
    const r = installPreset(db, pid, m);
    assert.ok(!r.success && /Invalid manifest/.test(r.message));
    assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM tables WHERE project_id = ?').get(pid).c, 0);
});

t('mid-transaction failure rolls back everything', () => {
    const { db, pid } = freshDb();
    const m = miniManifest();
    // Pass validation, then break the DB underneath: drop a table the installer needs.
    const origRun = db.prepare('SELECT 1').run.bind(db);
    let calls = 0;
    const wrapped = installPreset(db, pid, {
        ...m,
        custom_modules: [{ ref: 'boom', base_table_ref: 'litters', module_name: 'Boom',
            get settings_override() { throw new Error('kaboom'); } }],
    }, { skipValidation: true });
    assert.ok(!wrapped.success && /kaboom/.test(wrapped.message));
    assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM tables WHERE project_id = ?').get(pid).c, 0);
    assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM menu_items WHERE project_id = ?').get(pid).c, 0);
});

t('two different packs coexist in one project', () => {
    const { db, pid } = freshDb();
    const a = miniManifest();
    const b = miniManifest();
    b.slug = 'mini-pack-2';
    b.tables.forEach((tb) => { tb.table_name = tb.table_name + '_b'; tb.ref = tb.ref + '_b'; });
    b.relationships[0].parent_ref = 'cats_b'; b.relationships[0].child_ref = 'litters_b';
    b.custom_modules[0].base_table_ref = 'litters_b';
    b.custom_modules[0].module_name = 'Open Litters B';
    assert.ok(installPreset(db, pid, a).success);
    const rb = installPreset(db, pid, b);
    assert.ok(rb.success, rb.message);
    assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM tables WHERE project_id = ?').get(pid).c, 4);
});

t('injection-shaped names rejected by validator before any SQL', () => {
    const { db, pid } = freshDb();
    const m = miniManifest();
    m.tables[0].table_name = 'cats"; DROP TABLE projects;--';
    const r = installPreset(db, pid, m);
    assert.ok(!r.success);
    assert.ok(db.prepare('SELECT 1 FROM projects WHERE project_id = ?').get(pid));
});

t('checkCollisions pure function', () => {
    const { db, pid } = freshDb();
    installPreset(db, pid, miniManifest());
    const c = checkCollisions(db, pid, miniManifest());
    assert.ok(c.tables.includes('cats') && c.tables.includes('litters'));
    assert.ok(c.modules.includes('Open Litters'));
});

t('loadBundledPresets + presetSummary shape', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-presets-'));
    fs.writeFileSync(path.join(dir, 'a-pack.json'), JSON.stringify(miniManifest()));
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignore me');
    fs.writeFileSync(path.join(dir, 'broken.json'), '{oops');
    const packs = loadBundledPresets(dir);
    assert.strictEqual(packs.length, 1);
    const s = presetSummary(packs[0].manifest);
    assert.strictEqual(s.slug, 'mini-pack');
    assert.strictEqual(s.tables.length, 2);
    assert.strictEqual(s.tables[1].approval_enabled, true);
    assert.strictEqual(s.custom_modules[0].base_table, 'litters');
});

console.log(`\n${passed} presetInstaller tests passed`);
