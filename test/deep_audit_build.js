// Fasa 20 — DEEP-AUDIT-001 fixture builder.
//
// Builds the shared deep-audit project through the REAL IPC handler registry
// (register.js via a fake ipcMain shim — the same engine the GUI SaveManager
// drives), into an ISOLATED store (FSM_DATA_DIR). No SQL import: the schema
// takes the native create/rename/shape path exactly like a user would.
//
// Usage: FSM_DATA_DIR=/tmp/fsm-deep-store node test/deep_audit_build.js
//
// The fixture spreads the full display_type matrix (16+ shapes) across the
// plan's six tables so every shape is exercised in a real generated app:
//   pelajar      text/varchar/email/tel/image/text_area/options dropdown/decimal/date
//   kursus       varchar/unique/decimal/date/datetime/options radios/integer
//   pendaftaran  lookups/repeater simple/repeater complex/check_box/options multi/datetime
//   bayaran      decimal required/datetime/options dropdown/upload file
//   dokumen      upload/image/attachments/gmap/youtube/repeater simple
//   audit_log    varchar/datetime/text_area/read-only check_box
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..');
process.env.FSM_DATA_DIR = process.env.FSM_DATA_DIR || '/tmp/fsm-deep-store';
fs.mkdirSync(process.env.FSM_DATA_DIR, { recursive: true });

const { openStore } = require('../src/core/store');
// Fresh store per build: relationship:upsert resolves tables by NAME globally
// (see tenancyManager.js note), so leftover projects with the same table names
// in the store would hijack the relationship rows. The GUI only ever has one
// active project; mirror that here.
fs.rmSync(process.env.FSM_DATA_DIR, { recursive: true, force: true });
fs.mkdirSync(process.env.FSM_DATA_DIR, { recursive: true });
const db = openStore();

// --- register.js handler capture (same shim as bin/fixzy.js) ---
const handlers = new Map();
const shim = {
    handle: (name, fn) => handlers.set(name, fn),
    on: () => {},
    once: () => {},
};
require('../src/handlers/register')({
    ipcMain: shim,
    db,
    getPath: () => process.env.FSM_DATA_DIR,
    getWindow: () => null,
    dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }), showMessageBox: async () => ({ response: 0 }) },
    shell: { openExternal: async () => {} },
    isPackaged: false,
    enforceOutputRoots: true,
    onQuit: () => {},
});
const call = (name, ...args) => handlers.get(name)(null, ...args);

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
    if (cond) { pass++; console.log('PASS  ' + name); }
    else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}

// Field shape: base defaults mirror what the GUI seeds for a new VARCHAR field.
/** @param {string} name @param {string} caption @param {object} shape extra field columns @returns {object} */
function mkField(name, caption, shape = {}) {
    return { field_name: name, caption, ...shape };
}

// Table spec: rename + table-level flags + fields + relationships (added later).
const TABLES = [
    {
        name: 'pelajar', module: 'Pelajar', title: 'Pelajar',
        fields: [
            mkField('nama', 'Nama', { data_type: 'VARCHAR', length: 100, required: 1, not_null: 1 }),
            mkField('email', 'E-mel', { data_type: 'VARCHAR', length: 150, format_as: 'email' }),
            mkField('no_tel', 'No Telefon', { data_type: 'VARCHAR', length: 20, format_as: 'tel' }),
            mkField('gambar', 'Gambar', { data_type: 'VARCHAR', length: 255, media_type: 'image', allow_image_uploads: 1, image_storage_provider: 'public' }),
            mkField('bio', 'Bio', { data_type: 'TEXT', display_type: 'text_area' }),
            mkField('gred', 'Gred', { data_type: 'VARCHAR', length: 20, display_type: 'options_list', options_display: 'dropdown', options_list_values: 'cemerlang;;baik;;sederhana' }),
            mkField('perbelanjaan', 'Perbelanjaan', { data_type: 'DECIMAL', length: 10, precision: 2 }),
            mkField('lahir', 'Tarikh Lahir', { data_type: 'DATE', display_type: 'datetime_input' }),
        ],
    },
    {
        name: 'kursus', module: 'Kursus', title: 'Kursus',
        fields: [
            mkField('kod', 'Kod', { data_type: 'VARCHAR', length: 20, required: 1, unique: 1 }),
            mkField('tajuk', 'Tajuk', { data_type: 'VARCHAR', length: 200, required: 1 }),
            mkField('yuran', 'Yuran', { data_type: 'DECIMAL', length: 10, precision: 2 }),
            mkField('mula', 'Tarikh Mula', { data_type: 'DATE', display_type: 'datetime_input' }),
            mkField('jadual', 'Jadual', { data_type: 'DATETIME', display_type: 'datetime_input' }),
            mkField('tahap', 'Tahap', { data_type: 'VARCHAR', length: 20, display_type: 'options_list', options_display: 'radios', options_list_values: 'asas;;pertengahan;;lanjutan' }),
            mkField('deskripsi', 'Deskripsi', { data_type: 'TEXT', display_type: 'rich_html' }),
            mkField('kapasiti', 'Kapasiti', { data_type: 'INT' }),
        ],
    },
    {
        name: 'pendaftaran', module: 'Pendaftaran', title: 'Pendaftaran',
        fields: [
            mkField('pelajar_id', 'Pelajar', { data_type: 'INT', lookup_parent_table: 'pelajar', lookup_caption_1: 'nama' }),
            mkField('kursus_id', 'Kursus', { data_type: 'INT', lookup_parent_table: 'kursus', lookup_caption_1: 'tajuk' }),
            mkField('tags', 'Tag', { data_type: 'JSON', display_type: 'repeater_simple', repeater_simple_display_as: 'text_input' }),
            mkField('butiran', 'Butiran', {
                data_type: 'JSON', display_type: 'repeater',
                repeater_1_display_as: 'text_input',
                repeater_2_display_as: 'dropdown_list', repeater_2_list_values: 'tinggi;;rendah',
                repeater_3_display_as: 'text_input',
            }),
            mkField('lulus', 'Lulus', { data_type: 'BOOLEAN', display_type: 'check_box' }),
            mkField('keutamaan', 'Keutamaan', { data_type: 'VARCHAR', length: 50, display_type: 'options_list', options_display: 'multi', options_list_values: 'awal;;pertengahan;;akhir' }),
            mkField('hadir_pada', 'Hadir Pada', { data_type: 'DATETIME', display_type: 'datetime_input' }),
        ],
    },
    {
        name: 'bayaran', module: 'Bayaran', title: 'Bayaran',
        fields: [
            mkField('jumlah', 'Jumlah', { data_type: 'DECIMAL', length: 10, precision: 2, required: 1, not_null: 1 }),
            mkField('dibayar_pada', 'Dibayar Pada', { data_type: 'DATETIME', display_type: 'datetime_input' }),
            mkField('kaedah', 'Kaedah', { data_type: 'VARCHAR', length: 20, display_type: 'options_list', options_display: 'dropdown', options_list_values: 'tunai;;kad;;online' }),
            mkField('resit', 'Resit', { data_type: 'VARCHAR', length: 255, media_type: 'upload', allow_file_uploads: 1, file_types: 'pdf,jpg,png', file_max_size: 2048 }),
            mkField('rujukan', 'Rujukan', { data_type: 'VARCHAR', length: 50 }),
        ],
    },
    {
        name: 'dokumen', module: 'Dokumen', title: 'Dokumen',
        fields: [
            mkField('tajuk_dok', 'Tajuk Dokumen', { data_type: 'VARCHAR', length: 150, required: 1 }),
            mkField('fail', 'Fail', { data_type: 'VARCHAR', length: 255, media_type: 'upload', allow_file_uploads: 1, file_types: 'pdf,txt', file_max_size: 2048 }),
            mkField('imej', 'Imej', { data_type: 'VARCHAR', length: 255, media_type: 'image', allow_image_uploads: 1, image_storage_provider: 'public' }),
            mkField('galeri', 'Galeri', { data_type: 'VARCHAR', length: 255, media_type: 'attachments', attach_max_files: 3, attach_types: 'png,jpg', attach_max_size: 1024 }),
            mkField('lokasi', 'Lokasi', { data_type: 'VARCHAR', length: 500, media_type: 'gmap', tv_icon: 'map-pin' }),
            mkField('video', 'Video', { data_type: 'VARCHAR', length: 500, media_type: 'youtube', tv_icon: 'play-circle' }),
            mkField('catatan', 'Catatan', { data_type: 'JSON', display_type: 'repeater_simple', repeater_simple_display_as: 'text_input' }),
        ],
    },
    {
        name: 'audit_log', module: 'AuditLog', title: 'Audit Log',
        fields: [
            mkField('tindakan', 'Tindakan', { data_type: 'VARCHAR', length: 100, required: 1 }),
            mkField('berlaku_pada', 'Berlaku Pada', { data_type: 'DATETIME', display_type: 'datetime_input' }),
            mkField('maklumat', 'Maklumat', { data_type: 'TEXT', display_type: 'text_area' }),
            mkField('dikunci', 'Dikunci', { data_type: 'BOOLEAN', display_type: 'check_box', read_only: 1 }),
        ],
    },
    {
        // Fasa 21 — special fields: calculated, algorithm, defaults, owner,
        // read-only text, lookup with caption separator.
        name: 'spesial', module: 'Spesial', title: 'Spesial', record_owner: 'current_user',
        fields: [
            mkField('nama_spesial', 'Nama Spesial', { data_type: 'VARCHAR', length: 100, required: 1, not_null: 1 }),
            mkField('bil_a', 'Bil A', { data_type: 'INT' }),
            mkField('bil_b', 'Bil B', { data_type: 'INT' }),
            mkField('jumlah_kira', 'Jumlah Kira', { data_type: 'INT', calculated_enable: 1, calculated_query: 'SELECT COALESCE(SUM(`bil_a` + `bil_b`), 0)\nFROM `spesial`\nWHERE `spesial`.`id` = ##ID##;' }),
            mkField('status_algo', 'Status Algo', { data_type: 'VARCHAR', length: 50, algorithm_enable: 1, algorithm_logic: 'sum' }),
            mkField('no_rujukan', 'No Rujukan', { data_type: 'VARCHAR', length: 50, default_value: 'AUTO-123' }),
            mkField('tarikh_daftar', 'Tarikh Daftar', { data_type: 'DATETIME', display_type: 'datetime_input', default_value: 'CURRENT_TIMESTAMP' }),
            mkField('kod_kunci', 'Kod Kunci', { data_type: 'VARCHAR', length: 50, read_only: 1, default_value: 'ASAL' }),
            mkField('pelajar_ganda', 'Pelajar Ganda', { data_type: 'INT', lookup_parent_table: 'pelajar', lookup_caption_1: 'nama', lookup_separator: ' - ', lookup_caption_2: 'email', lookup_display_as: 'dropdown' }),
            // created_by / updated_by are auto-added by the record_owner
            // machinery (model creating/updating hooks) — do NOT declare them.
        ],
    },
    {
        // Fasa 22 — grid semantics: summaries, group-by, kanban,
        // calendar, tree. Numeric fields for SUM/AVG/COUNT/MIN/MAX.
        name: 'gridtest', module: 'Gridtest', title: 'Grid Test',
        enable_row_actions: 1,
        grid_summaries: '{"nilai": "sum", "skor": "avg", "kuantiti": "count", "tinggi": "min", "lebar": "max"}',
        grid_group_by: 'kategori',
        grid_kanban_enabled: 1,
        grid_kanban_config: '{"group_field":"status_kerja","card_fields":["nama_item"],"allowed_transitions":{"Draft":["Review"],"Review":["Approved","Draft"]}}',
        grid_calendar_enabled: 1,
        grid_calendar_config: '{"start_field":"tarikh_hantar","end_field":"","title_field":"nama_item","color_field":""}',
        grid_tree_enabled: 1,
        grid_tree_config: '{"parent_field":"parent_id","label_field":"nama_item"}',
        fields: [
            mkField('nama_item', 'Nama Item', { data_type: 'VARCHAR', length: 100, required: 1, not_null: 1 }),
            mkField('nilai', 'Nilai', { data_type: 'DECIMAL', length: 10, precision: 2 }),
            mkField('skor', 'Skor', { data_type: 'INT' }),
            mkField('kuantiti', 'Kuantiti', { data_type: 'INT' }),
            mkField('tinggi', 'Tinggi', { data_type: 'INT' }),
            mkField('lebar', 'Lebar', { data_type: 'INT' }),
            mkField('kategori', 'Kategori', { data_type: 'VARCHAR', length: 20, display_type: 'options_list', options_display: 'dropdown', options_list_values: 'alpha;;beta;;gama' }),
            mkField('status_kerja', 'Status Kerja', { data_type: 'VARCHAR', length: 20, display_type: 'options_list', options_display: 'dropdown', options_list_values: 'Draft;;Review;;Approved' }),
            mkField('tarikh_hantar', 'Tarikh Hantar', { data_type: 'DATE', display_type: 'datetime_input' }),
            mkField('parent_id', 'Parent', { data_type: 'INT' }),
        ],
    },
];

(async () => {
    // 1. Project (project:create also seeds the users table — expected).
    const proj = await call('project:create', 'DEEP-AUDIT-001');
    if (!proj || !proj.project_id) throw new Error('project:create failed');
    const projectId = proj.project_id;
    check('P1. project created', !!projectId, 'id=' + projectId);

    // Project-level flags: soft delete + Malay + KL timezone (plan fixture spec).
    const pu = await call('project:update', {
        project_id: projectId,
        data_delete_type: 'soft',
        language_select: 'Malay',
        timezone_select: 'Asia/Kuala_Lumpur',
        module_fake_data: 0,
    });
    check('P2. project flags saved (soft delete, MS, KL tz, no fake data)', pu && pu.success === true);

    // 2. Tables: create via handler (random name), then rename + flag.
    const tableIds = {};
    for (const spec of TABLES) {
        const t = await call('table:create', projectId);
        if (!t || !t.table_id) throw new Error('table:create failed for ' + spec.name);
        const upd = await call('table:update', {
            table_id: t.table_id,
            table_name: spec.name,
            module_name: spec.module,
            table_view_title: spec.title,
            enable_detail_view: 1,
            allow_csv_export: 1,
            allow_csv_import: 1,
            ...(spec.record_owner ? { record_owner: spec.record_owner } : {}),
            ...(spec.grid_summaries ? { grid_summaries: spec.grid_summaries } : {}),
            ...(spec.grid_group_by ? { grid_group_by: spec.grid_group_by } : {}),
            ...(spec.grid_kanban_enabled ? { grid_kanban_enabled: 1, grid_kanban_config: spec.grid_kanban_config } : {}),
            ...(spec.grid_calendar_enabled ? { grid_calendar_enabled: 1, grid_calendar_config: spec.grid_calendar_config } : {}),
            ...(spec.grid_tree_enabled ? { grid_tree_enabled: 1, grid_tree_config: spec.grid_tree_config } : {}),
            ...(spec.enable_row_actions ? { show_delete_button: 1, allow_restore_delete: 1, allow_force_delete: 1 } : {}),
        });
        check(`T1. table '${spec.name}' created+renamed`, upd && upd.success !== false);
        tableIds[spec.name] = t.table_id;
        // Keep the menu label in sync with the rename (GUI does this in its own flow).
        db.prepare('UPDATE menu_items SET item_label = ? WHERE project_id = ? AND table_id = ?')
            .run(spec.title, projectId, t.table_id);
    }

    // 3. Fields: create via handler, then apply the full shape.
    let fieldCount = 0;
    for (const spec of TABLES) {
        for (const f of spec.fields) {
            const created = await call('field:create', tableIds[spec.name]);
            if (!created || !created.field_id) throw new Error('field:create failed for ' + spec.name + '.' + f.field_name);
            const upd = await call('field:update', { field_id: created.field_id, ...f });
            if (!upd || upd.success === false) {
                check(`F1. ${spec.name}.${f.field_name} shape saved`, false, (upd && upd.message) || 'no result');
                continue;
            }
            fieldCount++;
        }
    }
    const wantFields = TABLES.reduce((n, s) => n + s.fields.length, 0);
    check('F2. all field shapes applied', fieldCount === wantFields, `${fieldCount}/${wantFields}`);

    // 4. Relationships for the lookup fields (required by generated forms).
    const rel1 = await call('relationship:upsert', { parentTableName: 'pelajar', childTableName: 'pendaftaran', fk_child_field: 'pelajar_id' });
    const rel2 = await call('relationship:upsert', { parentTableName: 'kursus', childTableName: 'pendaftaran', fk_child_field: 'kursus_id' });
    const rel3 = await call('relationship:upsert', { parentTableName: 'pelajar', childTableName: 'spesial', fk_child_field: 'pelajar_ganda' });
    check('R1. pendaftaran->pelajar relationship', rel1 && rel1.success === true);
    check('R2. pendaftaran->kursus relationship', rel2 && rel2.success === true);
    check('R3. spesial->pelajar (ganda) relationship', rel3 && rel3.success === true);

    // 5. Verify via the real schema assembly the generator consumes.
    const full = await call('project:get-full-schema', projectId);
    const tables = full && full.database && full.database.table || {};
    check('S1. full schema has all 9 tables (8 + users)', Object.keys(tables).length === 9, Object.keys(tables).join(','));
    const rels = (full.database.relationships || []).filter(r => r.child_table_name === 'pendaftaran');
    check('S2. pendaftaran has 2 relationships in schema', rels.length === 2, 'n=' + rels.length);
    const pel = tables.pelajar || {};
    const shapes = Object.values(pel.fields || {}).map(f => `${f.field_name}:${f.display_type}/${f.media_type}`).sort();
    check('S3. pelajar field shapes persisted', shapes.length === 15, shapes.join(' '));

    // 6. Persist a canonical copy of the built schema for the boot script.
    fs.writeFileSync(path.join(process.env.FSM_DATA_DIR, 'deep_audit_schema.json'), JSON.stringify(full, null, 2));
    console.log(`\nDEEP-AUDIT-001 built: project ${projectId}, store ${process.env.FSM_DATA_DIR}`);
    console.log(pass + ' pass, ' + fail + ' fail');
    db.close();
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('BUILD FATAL:', e.message); try { db.close(); } catch {} process.exit(1); });
