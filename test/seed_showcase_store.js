// Seeds the showcase project into an ISOLATED store (FSM_DATA_DIR) so the
// SysMaker GUI renders a full, rich project for screenshots.
// Usage: FSM_DATA_DIR=/tmp/fixzy_showcase node test/seed_showcase_store.js
'use strict';
const fs = require('fs');
const path = require('path');
const { openStore } = require('../src/core/store');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'showcase_demo.json'), 'utf8'));
const db = openStore();

function cols(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}
function insertFromObj(table, obj, { skip = [] } = {}) {
  const have = new Set(cols(table));
  const keys = Object.keys(obj).filter((k) => have.has(k) && !skip.includes(k));
  // Quote identifiers: `unique` and friends are SQLite reserved words.
  const stmt = db.prepare(`INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`);
  const vals = keys.map((k) => {
    const v = obj[k];
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v === undefined ? null : v;
  });
  return stmt.run(...vals);
}

const tx = db.transaction(() => {
  // 1. Project
  const proj = { ...fixture.project, is_active: 1 };
  insertFromObj('projects', proj);
  const projectId = fixture.project.project_id;

  // 2. Tables + fields
  for (const t of Object.values(fixture.database.table)) {
    insertFromObj('tables', t);
    for (const f of Object.values(t.fields || {})) {
      insertFromObj('fields', f);
    }
    for (const c of t.constraints || []) {
      insertFromObj('table_constraints', c);
    }
  }

  // 3. Menu groups + items (resolve table_name -> table_id)
  const nameToId = {};
  for (const t of Object.values(fixture.database.table)) nameToId[t.table_name] = t.table_id;
  for (const g of fixture.database.unified_menu) {
    if (g.type === 'group') {
      db.prepare('INSERT INTO menu_groups (menu_group_id, project_id, group_name, group_order) VALUES (?,?,?,?)')
        .run(g.id, projectId, g.name, g.order);
      for (const it of g.items || []) {
        db.prepare('INSERT INTO menu_items (item_id, project_id, menu_group_id, table_id, item_label, item_detail, item_order, show_record_count) VALUES (?,?,?,?,?,?,?,?)')
          .run(it.item_id, projectId, g.id, nameToId[it.table_name] ?? it.table_id ?? null, it.item_label, it.item_detail, it.order, it.show_record_count ? 1 : 0);
      }
    } else if (g.type === 'custom_item') {
      db.prepare('INSERT INTO menu_items (item_id, project_id, menu_group_id, table_id, item_label, item_detail, item_order, show_record_count) VALUES (?,?,?,?,?,?,?,?)')
        .run(g.item_id, projectId, null, null, g.item_label, g.item_detail, g.order, 0);
    }
  }

  // 4. Widgets (fixture ids are strings like 'w1'; DB id is INTEGER PK)
  (fixture.database.widgets || []).forEach((w, i) => {
    insertFromObj('project_widgets', { ...w, project_id: projectId, sort_order: i }, { skip: ['id'] });
  });
});
tx();

const counts = {
  projects: db.prepare('SELECT COUNT(*) c FROM projects').get().c,
  tables: db.prepare('SELECT COUNT(*) c FROM tables').get().c,
  fields: db.prepare('SELECT COUNT(*) c FROM fields').get().c,
  menu_groups: db.prepare('SELECT COUNT(*) c FROM menu_groups').get().c,
  menu_items: db.prepare('SELECT COUNT(*) c FROM menu_items').get().c,
  widgets: db.prepare('SELECT COUNT(*) c FROM project_widgets').get().c,
};
console.log('seeded:', JSON.stringify(counts));
