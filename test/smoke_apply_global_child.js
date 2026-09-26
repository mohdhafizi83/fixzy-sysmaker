// Smoke test: layout:apply-global with applyChildLayout against a real sqlite DB.
'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'applyglobal-'));
const db = new Database(path.join(tmp, 'test.db'));

// Build schema from resources/schema.sql (same as store.js init)
const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'resources', 'schema.sql'), 'utf8');
db.exec(schemaSql);

// Seed global defaults
db.prepare("INSERT OR REPLACE INTO fixzy_settings (setting_name, setting_value) VALUES ('global_tv_template','vertical_1')").run();
db.prepare("INSERT OR REPLACE INTO fixzy_settings (setting_name, setting_value) VALUES ('global_card_columns','4')").run();
db.prepare("INSERT OR REPLACE INTO fixzy_settings (setting_name, setting_value) VALUES ('global_form_layout_config','{\"style\":\"sections\",\"columns\":2}')").run();
db.prepare("INSERT OR REPLACE INTO fixzy_settings (setting_name, setting_value) VALUES ('global_child_tv_template','vertical_2')").run();
db.prepare("INSERT OR REPLACE INTO fixzy_settings (setting_name, setting_value) VALUES ('global_child_card_columns','5')").run();
db.prepare("INSERT OR REPLACE INTO fixzy_settings (setting_name, setting_value) VALUES ('global_child_form_style','grouped')").run();

// Project + tables + relationships
db.prepare("INSERT INTO projects (project_id, app_title) VALUES (1,'T')").run();
db.prepare("INSERT INTO tables (table_id, project_id, table_name) VALUES (1,1,'projek')").run();
db.prepare("INSERT INTO tables (table_id, project_id, table_name) VALUES (2,1,'tugas')").run();
db.prepare("INSERT INTO tables (table_id, project_id, table_name) VALUES (3,1,'audit_log')").run();
db.prepare("INSERT INTO parent_child_relationships (parent_table_id, child_table_id, fk_child_field, parent_field, relationship_type) VALUES (1,2,'projek_id','id','one-to-many')").run();
db.prepare("INSERT INTO parent_child_relationships (parent_table_id, child_table_id, fk_child_field, parent_field, relationship_type) VALUES (1,3,'projek_id','id','one-to-many')").run();
// Pre-set existing values to prove overwrite
db.prepare("UPDATE tables SET tv_template='horizontal', card_columns=3 WHERE table_id=2").run();
db.prepare("UPDATE parent_child_relationships SET show_tab=1 WHERE child_table_id=2").run();
db.prepare("UPDATE parent_child_relationships SET show_tab=0 WHERE child_table_id=3").run();

// Register handlers with a shim ipcMain so we can invoke them
const handlers = {};
const ipcShim = { handle: (name, fn) => { handlers[name] = fn; }, on: () => {} };
const ctx = {
    ipcMain: ipcShim,
    db,
    getPath: () => tmp,
    getWindow: () => null,
    dialog: { showOpenDialog: async () => ({ canceled: true }) },
    shell: { openExternal: async () => {} },
    isPackaged: false,
};
require('../src/handlers/register.js')(ctx);

(async () => {
    // 1. applyChildLayout only
    let res = await handlers['layout:apply-global'](null, { projectId: 1, applyTableView: false, applyFormLayout: false, applyChildLayout: true });
    console.log('applyChild only:', JSON.stringify(res));
    const rel = db.prepare('SELECT * FROM parent_child_relationships WHERE child_table_id=2').get();
    console.log('rel t2:', rel.tv_template, rel.card_columns, rel.form_style);
    const t2 = db.prepare("SELECT tv_template, card_columns, form_layout_config FROM tables WHERE table_id=2").get();
    console.log('t2 table unchanged?', JSON.stringify(t2));
    const t3 = db.prepare("SELECT tv_template FROM tables WHERE table_id=3").get();
    console.log('t3 table:', JSON.stringify(t3));

    // 2. applyTableView should NOT touch relationships
    res = await handlers['layout:apply-global'](null, { projectId: 1, applyTableView: true, applyFormLayout: false, applyChildLayout: false });
    const rel2 = db.prepare('SELECT tv_template FROM parent_child_relationships WHERE child_table_id=2').get();
    const t2b = db.prepare("SELECT tv_template FROM tables WHERE table_id=2").get();
    console.log('viewOnly: rel still vertical_2?', rel2.tv_template, '| table now vertical_1?', t2b.tv_template);

    // 3. show_tab global: t3 was 0 -> should become 1 (global default show)
    const rel3 = db.prepare('SELECT show_tab FROM parent_child_relationships WHERE child_table_id=3').get();
    console.log('t3 show_tab after applyChild:', rel3.show_tab);

    // 4. empty global child tv should NOT overwrite existing rel tv
    db.prepare("UPDATE fixzy_settings SET setting_value='' WHERE setting_name='global_child_tv_template'").run();
    res = await handlers['layout:apply-global'](null, { projectId: 1, applyTableView: false, applyFormLayout: false, applyChildLayout: true });
    const rel4 = db.prepare('SELECT tv_template, form_style FROM parent_child_relationships WHERE child_table_id=2').get();
    console.log('empty global tv: rel tv preserved?', rel4.tv_template, '| form_style still grouped?', rel4.form_style);

    console.log('SMOKE_DONE');
})().catch(e => { console.error('SMOKE_FAIL', e); process.exit(1); });
