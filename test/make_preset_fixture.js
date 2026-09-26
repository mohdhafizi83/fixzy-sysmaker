// Generate golden fixtures for Starter Packs by installing each bundled
// manifest into a temp SQLite DB and dumping the full project schema in
// the exact shape the golden harness expects (mirrors the production
// getFullProjectSchema in src/handlers/register.js).
//
// Usage:
//   node test/make_preset_fixture.js <slug>     one pack
//   node test/make_preset_fixture.js            all bundled packs
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { openStore } = require('../src/core/store');
const { installPreset, loadBundledPresets } = require('../src/core/presetInstaller');

const PRESETS_DIR = path.join(__dirname, '..', 'src', 'presets');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function dumpFullSchema(db, projectId) {
    const project = db.prepare('SELECT * FROM projects WHERE project_id = ?').get(projectId);
    const widgets = db.prepare('SELECT * FROM project_widgets WHERE project_id = ? ORDER BY sort_order ASC').all(projectId);
    const tables = db.prepare('SELECT * FROM tables WHERE project_id = ? ORDER BY table_order, table_id').all(projectId);
    const tableIds = tables.map((t) => t.table_id);
    const structuredTables = {};
    if (tableIds.length === 0) {
        return { project, database: { name: project.app_title, table: {}, relationships: [], unified_menu: [], widgets } };
    }
    const ph = tableIds.map(() => '?').join(',');
    const fields = db.prepare(`SELECT * FROM fields WHERE table_id IN (${ph}) ORDER BY field_order, field_id`).all(...tableIds);
    const constraints = db.prepare(`SELECT * FROM table_constraints WHERE table_id IN (${ph})`).all(...tableIds);
    const customViews = db.prepare(`SELECT * FROM custom_modules WHERE table_id IN (${ph}) ORDER BY module_order`).all(...tableIds);
    const viewIds = customViews.map((v) => v.module_id);
    let customViewFields = [];
    if (viewIds.length) {
        const vph = viewIds.map(() => '?').join(',');
        customViewFields = db.prepare(`SELECT * FROM custom_module_fields WHERE module_id IN (${vph}) ORDER BY display_order`).all(...viewIds);
    }
    const validations = db.prepare(`
        SELECT fv.*, f.table_id, f.field_name
        FROM field_validations fv
        JOIN fields f ON fv.column_id = f.field_id
        WHERE f.table_id IN (${ph}) AND fv.is_active = 1
    `).all(...tableIds);

    tables.forEach((table) => {
        const viewsForTable = customViews.filter((v) => v.table_id === table.table_id);
        viewsForTable.forEach((view) => {
            view.fields = customViewFields.filter((f) => f.module_id === view.module_id);
        });
        structuredTables[table.table_name] = {
            ...table,
            fields: {},
            custom_modules: viewsForTable,
            constraints: constraints.filter((c) => c.table_id === table.table_id),
        };
    });
    fields.forEach((field) => {
        const parentTable = tables.find((t) => t.table_id === field.table_id);
        if (parentTable) {
            field.validations = validations.filter((v) => v.column_id === field.field_id);
            structuredTables[parentTable.table_name].fields[field.field_name] = field;
        }
    });
    const relationships = db.prepare(`
        SELECT r.*, p.table_name as parent_table_name, c.table_name as child_table_name
        FROM parent_child_relationships r
        JOIN tables p ON r.parent_table_id = p.table_id
        JOIN tables c ON c.table_id = r.child_table_id
        WHERE r.parent_table_id IN (${ph}) OR r.child_table_id IN (${ph})
    `).all(...tableIds, ...tableIds);

    const allItems = db.prepare(`
        SELECT mi.*, t.table_name
        FROM menu_items mi
        LEFT JOIN tables t ON mi.table_id = t.table_id
        WHERE mi.project_id = ?
        ORDER BY mi.item_order
    `).all(projectId);
    const groups = db.prepare('SELECT * FROM menu_groups WHERE project_id = ? ORDER BY group_order').all(projectId);
    const unifiedMenu = [];
    groups.forEach((group) => {
        const groupItems = allItems
            .filter((item) => item.menu_group_id === group.menu_group_id)
            .map((item) => {
                let itemType = 'custom_item';
                if (item.table_id) itemType = 'table_item';
                else if (item.module_id) itemType = 'custom_module_item';
                return { type: itemType, ...item };
            });
        unifiedMenu.push({ type: 'group', id: group.menu_group_id, order: group.group_order, name: group.group_name, items: groupItems });
    });
    allItems.forEach((item) => {
        if (item.menu_group_id === null) {
            let itemType = 'custom_item';
            if (item.table_id) itemType = 'table_item';
            else if (item.module_id) itemType = 'custom_module_item';
            unifiedMenu.push({ type: itemType, order: item.item_order, ...item });
        }
    });
    unifiedMenu.sort((a, b) => a.order - b.order);

    return {
        project,
        database: {
            name: project.app_title,
            table: structuredTables,
            relationships,
            unified_menu: unifiedMenu,
            widgets,
        },
    };
}

function makeFixture(slug) {
    const packs = loadBundledPresets(PRESETS_DIR);
    const found = packs.find((p) => p.manifest.slug === slug);
    if (!found) {
        console.error(`Unknown preset: ${slug}`);
        process.exitCode = 1;
        return null;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-preset-fixture-'));
    const db = openStore(path.join(dir, 'fixture.db'));
    const projectId = db.prepare(
        "INSERT INTO projects (app_title, stack_base, stack_database, is_active) VALUES (?, 'laravel_filament', 'sqlite', 1)"
    ).run(`${slug} Pack`).lastInsertRowid;
    // Mirror the standard 'users' table that project:create always makes —
    // the generator and seeder assume it exists (soft-delete scope etc).
    const usersTableId = db.prepare(
        'INSERT INTO tables (project_id, table_name, module_name, table_view_title, table_order) VALUES (?, ?, ?, ?, ?)'
    ).run(projectId, 'users', 'Users', 'Users', 0).lastInsertRowid;
    db.prepare(
        'INSERT INTO menu_items (project_id, table_id, item_label, item_detail, item_order) VALUES (?, ?, ?, ?, ?)'
    ).run(projectId, usersTableId, 'Users', 'users Module', 0);
    const usersFields = [
        { name: 'id', caption: 'ID', type: 'BIGINT', length: 20, unsigned: 1, pk: 1, auto_increment: 1, read_only: 1, order: 0 },
        { name: 'name', caption: 'Name', type: 'VARCHAR', length: 255, required: 1, order: 1 },
        { name: 'email', caption: 'Email', type: 'VARCHAR', length: 255, required: 1, unique: 1, order: 2 },
        { name: 'email_verified_at', caption: 'Email Verified At', type: 'TIMESTAMP', order: 3 },
        { name: 'password', caption: 'Password', type: 'VARCHAR', length: 255, required: 1, order: 4 },
        { name: 'remember_token', caption: 'Remember Token', type: 'VARCHAR', length: 100, order: 5 },
        { name: 'created_at', caption: 'Created At', type: 'TIMESTAMP', order: 6 },
        { name: 'updated_at', caption: 'Updated At', type: 'TIMESTAMP', order: 7 },
        { name: 'deleted_at', caption: 'Deleted At', type: 'TIMESTAMP', order: 8 },
    ];
    const insU = db.prepare(`
        INSERT INTO fields (table_id, field_name, caption, data_type, length, "unique",
            required, primary_key, auto_increment, unsigned, read_only, field_order)
        VALUES (@table_id, @field_name, @caption, @data_type, @length, @unique,
            @required, @primary_key, @auto_increment, @unsigned, @read_only, @field_order)
    `);
    usersFields.forEach((f) => insU.run({
        table_id: usersTableId, field_name: f.name, caption: f.caption, data_type: f.type,
        length: f.length || null, unique: f.unique || 0, required: f.required || 0,
        primary_key: f.pk || 0, auto_increment: f.auto_increment || 0,
        unsigned: f.unsigned || 0, read_only: f.read_only || 0, field_order: f.order,
    }));
    const res = installPreset(db, projectId, found.manifest);
    if (!res.success) {
        console.error(`Install failed for ${slug}: ${res.message}`);
        process.exitCode = 1;
        return null;
    }
    const dump = dumpFullSchema(db, projectId);
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
    const outPath = path.join(FIXTURES_DIR, `preset_${slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(dump, null, 1));
    console.log(`Wrote ${outPath}`);
    return outPath;
}

const arg = process.argv[2];
if (arg) {
    makeFixture(arg);
} else {
    loadBundledPresets(PRESETS_DIR).forEach((p) => makeFixture(p.manifest.slug));
}
