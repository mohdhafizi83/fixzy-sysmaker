// Generate Fasa C (7.7a) targeted fixtures for never-taken branch directions.
// Clones real fixture shapes (trimmed), never hand-authored from scratch.
'use strict';
const fs = require('fs');
const path = require('path');
const FD = path.join(__dirname, 'fixtures');
const clone = (f) => JSON.parse(fs.readFileSync(path.join(FD, f), 'utf8'));
const save = (name, obj) => fs.writeFileSync(path.join(FD, name + '.json'), JSON.stringify(obj, null, 2) + '\n');

// ---------------------------------------------------------------------------
// 1. field_validation_matrix — covers FormField.php.njk true branches:
//    is_min_length, is_fixed_length, is_min_value, is_prefix, is_suffix,
//    suffix_icon_text, suffix_coloricon_text, multiple_validation
//    + FileUploadField avatar_crop (circular image)
//    + generic AttachmentsRelationManager ALLOWED_TYPES non-empty (iter+true)
// ---------------------------------------------------------------------------
{
    const d = clone('field_types_all.json');
    const t = d.database.table.semua_field;
    const fields = t.fields;
    const base = fields.teks_biasa; // VARCHAR text_input template field

    const mk = (name, order, mut) => {
        const f = JSON.parse(JSON.stringify(base));
        f.field_name = name;
        f.caption = name;
        f.field_order = order;
        f.primary_key = 0; f.auto_increment = 0; f.unique = 0;
        Object.assign(f, mut);
        fields[name] = f;
    };

    mk('min_len_teks', 100, { min_length: 5, length: 50 });
    mk('fixed_len_kod', 101, { min_length: 8, length: 8 });
    mk('prefix_gaji', 102, { prefix: 'RM ', min_value: 1000 });
    mk('suffix_unit', 103, { suffix: ' kg' });
    mk('suffix_icon', 104, { suffix_icon: 'tag' });
    mk('suffix_icon_color', 105, { suffix_icon_color: 'danger' });
    mk('multi_rules', 106, {
        validations: [
            { rule_type: 'between', rule_value_1: '1', rule_value_2: '100' },
            { rule_type: 'starts_with', rule_value_1: 'MY,SG' },
            { rule_type: 'regex', rule_value_1: '^[A-Z0-9]+$' },
        ],
    });
    // Circular avatar image -> FileUploadField avatar_crop true branch.
    mk('avatar_bulat', 107, {
        media_type: 'image', dv_thumb_shape: 'circular',
        data_type: 'VARCHAR', length: 255, display_type: 'text_input',
    });

    // Second table: generic attachments WITH type restrictions so the shared
    // manager's ALLOWED_TYPES is non-empty (iter + true branches).
    const t2 = JSON.parse(JSON.stringify(t));
    t2.table_id = 991;
    t2.table_name = 'dokumen_berjenis';
    t2.module_name = 'DokumenBerjenis';
    t2.attachments_enabled = 1;
    t2.fields = {
        id: JSON.parse(JSON.stringify(fields.id)),
        tajuk: JSON.parse(JSON.stringify(fields.teks_biasa)),
    };
    t2.fields.id.field_id = 9910; t2.fields.id.table_id = 991;
    t2.fields.tajuk.field_id = 9911; t2.fields.tajuk.table_id = 991;
    t2.fields.tajuk.field_name = 'tajuk'; t2.fields.tajuk.caption = 'Tajuk';
    // A typed attachment field drives allowedTypes via attachmentOptions.
    t2.fields.lampiran = JSON.parse(JSON.stringify(fields.teks_biasa));
    t2.fields.lampiran.field_id = 9912; t2.fields.lampiran.table_id = 991;
    t2.fields.lampiran.field_name = 'lampiran'; t2.fields.lampiran.caption = 'Lampiran';
    t2.fields.lampiran.media_type = 'attachments';
    t2.fields.lampiran.attach_types = 'pdf, png, docx';
    t2.fields.lampiran.attach_max_files = 5;
    // Lookup with caption_2 -> parent_fields_caption true branch.
    t2.fields.pemilik = JSON.parse(JSON.stringify(fields.teks_biasa));
    t2.fields.pemilik.field_id = 9913; t2.fields.pemilik.table_id = 991;
    t2.fields.pemilik.field_name = 'pemilik'; t2.fields.pemilik.caption = 'Pemilik';
    t2.fields.pemilik.lookup_parent_table = 'users';
    t2.fields.pemilik.lookup_caption_1 = 'name';
    t2.fields.pemilik.lookup_caption_2 = 'email';
    t2.fields.pemilik.lookup_separator = '-';
    d.database.table.dokumen_berjenis = t2;

    // Relationship entry so the belongsTo FK is generated for the lookup.
    d.database.relationships = d.database.relationships || [];
    d.database.relationships.push({
        relationship_id: 9901,
        parent_table_id: 1, child_table_id: 991,
        fk_child_field: 'pemilik', parent_field: 'id',
        relationship_type: 'one-to-many',
        show_tab: 0, show_icon: 0, autoclose_modal: 0,
        tab_title: 'Pemilik', copy_records: 0, show_link_above: 0,
        show_count_in_tv: 0, allow_add_from_tv: 0,
        on_delete: 'SET NULL', on_update: 'CASCADE',
        parent_table_name: 'users', child_table_name: 'dokumen_berjenis',
    });

    save('field_validation_matrix', d);
}

// ---------------------------------------------------------------------------
// 2. activity_no_authz — ActivityLog.php.njk line 78 FALSE branch:
//    module_log_activity=1 with module_authorization=0 -> "return true".
// ---------------------------------------------------------------------------
{
    const d = clone('activity_audit.json');
    d.project.app_title = 'Activity No Authz';
    d.project.module_authorization = 0;
    save('activity_no_authz', d);
}

// ---------------------------------------------------------------------------
// 3. calendar_color_title — CalendarPage.php.njk line 131 TRUE branch:
//    calendar with color_field set. (line 124 false = title_field empty.)
//    Modifies grid_phaseD2_on: add color_field + a second calendar table
//    with start_field only (title false branch).
// ---------------------------------------------------------------------------
{
    const d = clone('grid_phaseD2_on.json');
    const t = d.database.table.fakulti;
    const cfg = JSON.parse(t.grid_calendar_config);
    cfg.color_field = 'warna';
    t.grid_calendar_config = JSON.stringify(cfg);
    const wf = JSON.parse(JSON.stringify(t.fields.nama_fakulti));
    wf.field_id = 4490; wf.field_name = 'warna'; wf.caption = 'Warna';
    wf.data_type = 'VARCHAR'; wf.length = 16;
    t.fields.warna = wf;

    // Second calendar table: start_field only -> titleField FALSE branch.
    const t2 = JSON.parse(JSON.stringify(t));
    t2.table_id = 45;
    t2.table_name = 'mesyuarat';
    t2.module_name = 'Mesyuarat';
    t2.fields = {
        id: JSON.parse(JSON.stringify(t.fields.id)),
        tarikh_mula: JSON.parse(JSON.stringify(t.fields.tarikh_muktamad)),
    };
    t2.fields.id.field_id = 4500; t2.fields.id.table_id = 45;
    t2.fields.tarikh_mula.field_id = 4501; t2.fields.tarikh_mula.table_id = 45;
    t2.fields.tarikh_mula.field_name = 'tarikh_mula'; t2.fields.tarikh_mula.caption = 'Tarikh Mula';
    t2.grid_calendar_config = JSON.stringify({ start_field: 'tarikh_mula', end_field: '', title_field: '', color_field: '' });
    d.database.table.mesyuarat = t2;

    save('calendar_color_title', d);
}

console.log('Fasa C fixtures written: field_validation_matrix, activity_no_authz, calendar_color_title');
