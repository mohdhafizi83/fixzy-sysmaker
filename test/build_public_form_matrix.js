// Builds test/fixtures/public_form_matrix.json — a public-intake-form
// stress fixture: one form carrying EVERY field/display-type family
// (text formats, email, textarea, rich_html, checkbox, options_list
// dropdown/multi/radios, lookup FK dropdown + radios, repeater_simple,
// decimal, date/datetime) plus a second minimal form with lookup disabled,
// so the live browser test can verify each type end-to-end through
// /f/{slug}: render -> validate -> insert -> DB -> lookup.
// Usage: node test/build_public_form_matrix.js
'use strict';
const fs = require('fs');
const path = require('path');

function baseField(name, caption, dataType, opts = {}) {
    return Object.assign({
        field_id: opts.id || 1, table_id: 1, field_name: name, field_order: opts.order || 0,
        caption, description: null, data_type: dataType, length: opts.length ?? 255, precision: opts.precision ?? null,
        max_chars_in_tv: 50, alignment: 'left', default_value: null, read_only: 0, primary_key: 0, zero_fill: 0,
        required: opts.required || 0, not_null: opts.required ? 1 : 0,
        display_type: 'text_input', auto_increment: 0, unique: 0, is_indexed: 0,
        show_sum: 0, allow_sorting: 1, tv_wrap_header: 0, tv_wrap_text: 0, tv_enable_toggle: 0,
        tv_description_tooltips: 0, tv_text_limit: 50, tv_text_size: 'Normal', tv_font_weight: 'Regular',
        tv_date_time_format: 'date_and_time', tv_alignment: 'left', tv_text_color: null, tv_icon: null,
        tv_icon_color: null, tv_currency_code: null, unsigned: 0, enable_global_filter: 1,
        enable_individual_filter: 0, enable_range_filter: 0, binary: 0, hide_in_tv: 0, editable_in_tv: 0,
        hide_in_dv: 0, media_type: 'link', media_link_behavior: 'detail_view', media_link_display_as: 'field_contents',
        media_link_other_field: null, allow_image_uploads: 0, image_storage_provider: 'local', max_file_size: 250,
        delete_image_server: 0, dont_rename_image: 0, tv_thumb_shape: 'square', tv_thumb_width: 50,
        tv_thumb_height: 50, tv_enable_zooming: 0, tv_show_full_size: 0, dv_thumb_shape: 'square',
        dv_thumb_width: 250, dv_thumb_height: 250, dv_enable_zooming: 0, dv_show_full_size: 0,
        allow_file_uploads: 0, file_storage_provider: 'local', file_types: null, file_max_size: 2000,
        attach_max_files: 5, attach_types: null, attach_max_size: 2000, delete_file_server: 0,
        dont_rename_file: 0, file_behavior: 'download', file_display_as: 'field_contents', file_other_field: null,
        display_gmap: 0, gmap_type: 'roadmap', gmap_tv_width: 300, gmap_tv_height: 200, gmap_dv_height: 300,
        accept_video_url: 0, youtube_tv_width: 420, youtube_tv_height: 315, youtube_dv_width: 560,
        youtube_dv_height: 315, lookup_parent_table: null, lookup_caption_1: null, lookup_separator: null,
        lookup_caption_2: null, lookup_display_as: null, lookup_inherit_permissions: 0, lookup_link_behavior: null,
        lookup_searchable: 0, lookup_preload: 0, options_list_values: null, options_display: null,
        options_quick_list: 0, boolean_label_true: null, boolean_label_false: null, format_as: null,
        format_mask: null, off_autocomplete: 0, column_span_full: 0, repeater_simple_display_as: null,
        repeater_simple_format_as: null, repeater_simple_list_values: null, repeater_1_display_as: null,
        repeater_1_format_as: null, repeater_1_list_values: null, repeater_2_display_as: null,
        repeater_2_format_as: null, repeater_2_list_values: null, repeater_3_display_as: null,
        repeater_3_format_as: null, repeater_3_list_values: null, repeater_simple_required: 0,
        repeater_1_required: 0, repeater_2_required: 0, repeater_3_required: 0, prefix: null, suffix: null,
        suffix_icon: null, suffix_icon_color: null, calculated_enable: 0, calculated_query: null,
        lookup_custom_query: null, algorithm_enable: 0, algorithm_logic: null, calculation_builder_state: null,
        hook_functions: null, label_display: null, form_group: null, visible_if: null, required_if_state: null,
        depends_on: null,
    }, opts.extra || {});
}

let fid = 1;
function F(name, caption, dataType, opts = {}) { const f = baseField(name, caption, dataType, opts); f.field_id = fid++; return f; }

// ---- parent table (lookup / FK target) ----
const watakFields = [
    F('id', 'ID', 'INT', { extra: { primary_key: 1, auto_increment: 1 } }),
    F('nama_watak', 'Character Name', 'VARCHAR', { required: 1 }),
];

// ---- public intake table: every field family in one form ----
const aduanFields = [
    F('id', 'ID', 'INT', { extra: { primary_key: 1, auto_increment: 1 } }),
    F('txt_plain', 'Full Name', 'VARCHAR', { required: 1 }),
    F('txt_email', 'Email', 'VARCHAR', { required: 1, extra: { format_as: 'email' } }),
    F('txt_area', 'Description', 'TEXT', { extra: { display_type: 'text_area' } }),
    F('txt_rich', 'Rich Details', 'TEXT', { extra: { display_type: 'rich_html' } }),
    F('bool_urgent', 'Urgent', 'BOOLEAN', { extra: { display_type: 'check_box' } }),
    F('opt_category', 'Category', 'VARCHAR', { extra: { display_type: 'options_list', options_display: 'dropdown', options_list_values: 'rosak;;hilang;;lain' } }),
    F('opt_channels', 'Contact Channels', 'VARCHAR', { extra: { display_type: 'options_list', options_display: 'multi', options_list_values: 'email;;telefon;;sms' } }),
    F('opt_priority', 'Priority', 'VARCHAR', { extra: { display_type: 'options_list', options_display: 'radios', options_list_values: 'rendah;;sederhana;;tinggi' } }),
    F('lk_watak', 'Related Character', 'INT', { extra: { lookup_parent_table: 'watak', lookup_caption_1: 'nama_watak', lookup_display_as: 'dropdown' } }),
    F('lk_watak_radio', 'Favourite Character', 'INT', { extra: { lookup_parent_table: 'watak', lookup_caption_1: 'nama_watak', lookup_display_as: 'radios' } }),
    F('rep_notes', 'Extra Notes', 'JSON', { extra: { display_type: 'repeater_simple', repeater_simple_display_as: 'text_input' } }),
    F('num_amount', 'Claim Amount', 'DECIMAL', { length: 10, precision: 2 }),
    F('dt_event', 'Event Date', 'DATE', { extra: { display_type: 'datetime_input' } }),
    F('dt_report', 'Report Datetime', 'DATETIME', { extra: { display_type: 'datetime_input' } }),
    F('aduan_status', 'Status', 'VARCHAR', { extra: { display_type: 'options_list', options_display: 'dropdown', options_list_values: 'pending;;proses;;selesai' } }),
    // media fields (added 2026-10-01 public-form media audit)
    F('img_proof', 'Photo Evidence', 'VARCHAR', { required: 1, extra: { media_type: 'image', allow_image_uploads: 1, image_storage_provider: 'public', max_file_size: 250 } }),
    F('doc_form', 'Supporting Doc', 'VARCHAR', { extra: { media_type: 'upload', allow_file_uploads: 1, file_storage_provider: 'public', file_types: 'pdf,txt', file_max_size: 2000 } }),
    F('files_extra', 'Extra Attachments', 'VARCHAR', { extra: { media_type: 'attachments', allow_file_uploads: 1, attach_max_files: 2, attach_types: 'pdf,txt', attach_max_size: 1024 } }),
    F('map_place', 'Location (embed)', 'VARCHAR', { extra: { media_type: 'gmap', display_gmap: 1 } }),
    F('vid_evidence', 'Video (embed)', 'VARCHAR', { extra: { media_type: 'youtube', accept_video_url: 1 } }),
    F('internal_note', 'Internal Note', 'VARCHAR', {}), // deliberately NOT in allowed_fields
];

// ---- second public table: lookup disabled ----
const ringkasFields = [
    F('id', 'ID', 'INT', { extra: { primary_key: 1, auto_increment: 1 } }),
    F('nota', 'Message', 'VARCHAR', { required: 1 }),
];

function plainTable(tableId, name, module, fields, order, extra = {}) {
    return Object.assign({
        table_id: tableId, project_id: 1, table_name: name, table_order: order, module_name: module,
        table_view_title: module, table_description: null, show_quick_search: 1,
        allow_pagination: 1, pagination_type: 'simple', default_sort_by: null, sort_descending: 0,
        allow_csv_export: 1, allow_csv_import: 1, allow_print_view: 0, allow_mass_delete: 1,
        show_edit_button: 1, show_delete_button: 1, allow_restore_delete: 1, allow_force_delete: 0,
        tv_template: null, hide_field_captions: 0, use_first_field_as_title: 1,
        table_view_classes_input: null, detail_view_classes_input: null, detail_view_title: null,
        record_owner: null, owner_fk_value: null, default_focus: null, redirect_after_insert: null,
        enable_detail_view: 1, delete_with_children: 0, dv_allow_print_view: 0, dv_separate_page: 0,
        dv_hide_save_as_copy: 0, dv_sticky_buttons: 0, dv_allow_add_from_homepage: 0,
        column_grid_type: 'auto', static_grid_columns: 2, table_hook_workflow: null,
        feature_source: null,
        fields: Object.fromEntries(fields.map((f) => [f.field_name, f])),
        constraints: [],
        grid_multi_view: null, grid_view_default: null, grid_inline_edit: null,
        grid_summaries: null, grid_calendar_enabled: null, grid_calendar_config: null,
        grid_tree_enabled: null, grid_tree_config: null,
        grid_kanban_enabled: null, grid_kanban_config: null, card_columns: 3, card_columns_tablet: 2,
        public_form_enabled: 0, public_form_config: null,
    }, extra);
}

const baseFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'field_types_all.json'), 'utf8'));
const usersTable = JSON.parse(JSON.stringify(baseFixture.database.table.users));
usersTable.table_id = 3;

const fixture = {
    project: {
        project_id: 1, app_title: 'Public Form Matrix', date_format: '31 December 2026', time_format: '11:59 PM',
        language_select: 'English', timezone_select: 'Asia/Kuala_Lumpur', theme_select: 'bootstrap',
        use_3d_effects: 0, rtl: 0, compact: 0, menu_orientation: 'top', menu_at_homepage: 0,
        tables_per_row: 4, extra_wide: 0, panel_height: 100, hide_login: 0, allow_sql_tool: 0,
        allow_server_status: 0, admins_group_access: 1, allow_table_view_sql: 0, copy_children_async: 0,
        allow_pwa_install: 0, url: null, project_hook_workflow: null, stack_base: 'laravel',
        stack_database: 'sqlite', stack_theme: 'filament', data_delete_type: 'soft',
        module_auth_email: 1, module_auth_email_2fa: 0, module_auth_email_captcha: 0, module_auth_ldap: 0,
        module_auth_google_sso: 0, module_authorization: 'shield', module_log_audit: 0, module_fake_data: 0,
        tenancy_type: 'none', tenant_table: null, is_active: 1,
    },
    database: {
        name: 'public_form_matrix',
        table: {
            users: usersTable,
            watak: plainTable(1, 'watak', 'Characters', watakFields, 0),
            aduan: plainTable(2, 'aduan', 'Complaints', aduanFields, 1, {
                public_form_enabled: 1,
                public_form_config: JSON.stringify({
                    slug: 'aduan',
                    allowed_fields: [
                        'txt_plain', 'txt_email', 'txt_area', 'txt_rich', 'bool_urgent',
                        'opt_category', 'opt_channels', 'opt_priority',
                        'lk_watak', 'lk_watak_radio', 'rep_notes',
                        'num_amount', 'dt_event', 'dt_report',
                        'img_proof', 'doc_form', 'files_extra', 'map_place', 'vid_evidence',
                    ],
                    intro_text: 'Lodge your complaint here — all fields marked * are required.',
                    success_text: 'Your complaint has been received and will be reviewed.',
                    captcha_required: true,
                    status_field_default: 'pending',
                    lookup_enabled: true,
                }),
            }),
            ringkas: plainTable(4, 'ringkas', 'SimpleForms', ringkasFields, 2, {
                public_form_enabled: 1,
                public_form_config: JSON.stringify({
                    slug: 'ringkas',
                    allowed_fields: ['nota'],
                    intro_text: 'Quick message box',
                    success_text: 'Thanks!',
                    captcha_required: false,
                    status_field_default: '',
                    lookup_enabled: false,
                }),
            }),
        },
        relationships: [
            {
                relationship_id: 1, parent_table_id: 1, child_table_id: 2,
                fk_child_field: 'lk_watak', parent_field: 'id', relationship_type: 'many-to-one',
                show_tab: 0, show_icon: 0, autoclose_modal: 0, tab_title: null, copy_records: 0,
                show_link_above: 0, show_count_in_tv: 0, allow_add_from_tv: 0,
                on_delete: 'CASCADE', on_update: 'CASCADE',
                parent_table_name: 'watak', child_table_name: 'aduan',
            },
            {
                relationship_id: 2, parent_table_id: 1, child_table_id: 2,
                fk_child_field: 'lk_watak_radio', parent_field: 'id', relationship_type: 'many-to-one',
                show_tab: 0, show_icon: 0, autoclose_modal: 0, tab_title: null, copy_records: 0,
                show_link_above: 0, show_count_in_tv: 0, allow_add_from_tv: 0,
                on_delete: 'CASCADE', on_update: 'CASCADE',
                parent_table_name: 'watak', child_table_name: 'aduan',
            },
        ],
        unified_menu: [],
        widgets: [],
    },
};

const out = path.join(__dirname, 'fixtures', 'public_form_matrix.json');
fs.writeFileSync(out, JSON.stringify(fixture, null, 2));
console.log('wrote', out, '- aduan fields:', aduanFields.length);
