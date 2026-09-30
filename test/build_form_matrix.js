// Builds test/fixtures/form_matrix.json — one table per element-type family so
// the browser round-trip test can exercise EVERY form control the generator
// supports: text formats, textarea, rich html, checkbox, options_list
// (dropdown/radios/checkboxes/multi), lookup (dropdown/radios), date/datetime,
// repeater simple + complex.
// Usage: node test/build_form_matrix.js
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

// ---- parent table (lookup target) ----
const parentFields = [
    F('id', 'ID', 'INT', { extra: { primary_key: 1, auto_increment: 1 } }),
    F('nama_watak', 'Character Name', 'VARCHAR', { required: 1 }),
];

// ---- main matrix table ----
const matrixFields = [
    F('id', 'ID', 'INT', { extra: { primary_key: 1, auto_increment: 1 } }),
    // text formats
    F('txt_plain', 'Plain Text', 'VARCHAR', { required: 1 }),
    F('txt_email', 'Email', 'VARCHAR', { extra: { format_as: 'email' } }),
    F('txt_url', 'URL', 'VARCHAR', { extra: { format_as: 'url' } }),
    F('txt_tel', 'Telephone', 'VARCHAR', { extra: { format_as: 'tel' } }),
    F('txt_password', 'Password', 'VARCHAR', { extra: { format_as: 'password' } }),
    // numeric
    F('num_int', 'Integer', 'INT', {}),
    F('num_decimal', 'Decimal', 'DECIMAL', { length: 10, precision: 2 }),
    // date / datetime
    F('dt_date', 'Date', 'DATE', { extra: { display_type: 'datetime_input' } }),
    F('dt_datetime', 'Datetime', 'DATETIME', { extra: { display_type: 'datetime_input' } }),
    // long text
    F('txt_area', 'Text Area', 'TEXT', { extra: { display_type: 'text_area' } }),
    F('txt_rich', 'Rich Editor', 'TEXT', { extra: { display_type: 'rich_html' } }),
    // boolean
    F('bool_check', 'Checkbox', 'BOOLEAN', { extra: { display_type: 'check_box' } }),
    // options list variants
    F('opt_dropdown', 'Options Dropdown', 'VARCHAR', { extra: { display_type: 'options_list', options_display: 'dropdown', options_list_values: 'satu;;dua;;tiga' } }),
    F('opt_radios', 'Options Radios', 'VARCHAR', { extra: { display_type: 'options_list', options_display: 'radios', options_list_values: 'kiri;;tengah;;kanan' } }),
    F('opt_checkboxes', 'Options Checkboxes', 'VARCHAR', { extra: { display_type: 'options_list', options_display: 'checkboxes', options_list_values: 'merah;;hijau;;biru' } }),
    F('opt_multi', 'Options Multi', 'VARCHAR', { extra: { display_type: 'options_list', options_display: 'multi', options_list_values: 'awal;;tengah;;akhir' } }),
    // lookup variants
    F('lk_dropdown', 'Lookup Dropdown', 'INT', { extra: { lookup_parent_table: 'watak', lookup_caption_1: 'nama_watak', lookup_display_as: 'dropdown' } }),
    F('lk_radios', 'Lookup Radios', 'INT', { extra: { lookup_parent_table: 'watak', lookup_caption_1: 'nama_watak', lookup_display_as: 'radios' } }),
    // repeaters
    F('rep_simple', 'Repeater Simple', 'JSON', { extra: { display_type: 'repeater_simple', repeater_simple_display_as: 'text_input' } }),
    F('rep_complex', 'Repeater Complex', 'JSON', { extra: { display_type: 'repeater',
        repeater_1_display_as: 'text_input', repeater_1_format_as: 'email',
        repeater_2_display_as: 'dropdown_list', repeater_2_list_values: 'rendah;;tinggi' } }),
];

// ---- relation-manager family (added 2026-09-30 for RM audit) ----
// induk = parent; anak = hasMany child (default RM); anak_kad = hasMany
// child with card tv_template override; induk_extra = one-to-one (must NOT
// produce a relation manager tab).
const indukFields = [
    F('id', 'ID', 'INT', { extra: { primary_key: 1, auto_increment: 1 } }),
    F('nama_induk', 'Parent Name', 'VARCHAR', { required: 1 }),
    F('meta_decimal', 'Meta Decimal', 'DECIMAL', { length: 8, precision: 2 }),
    F('meta_date', 'Meta Date', 'DATE', { extra: { display_type: 'datetime_input' } }),
    F('lk_watak', 'Lookup Character', 'INT', { extra: { lookup_parent_table: 'watak', lookup_caption_1: 'nama_watak', lookup_display_as: 'dropdown' } }),
];
const anakFields = [
    F('id', 'ID', 'INT', { extra: { primary_key: 1, auto_increment: 1 } }),
    F('nama_anak', 'Child Name', 'VARCHAR', { required: 1 }),
    F('fk_induk', 'Parent', 'INT', { extra: { lookup_parent_table: 'induk', lookup_caption_1: 'nama_induk', lookup_display_as: 'dropdown' } }),
    F('status_opt', 'Status', 'VARCHAR', { extra: { display_type: 'options_list', options_display: 'dropdown', options_list_values: 'baru;;proses;;selesai' } }),
    F('qty', 'Quantity', 'INT', {}),
];
const anakKadFields = [
    F('id', 'ID', 'INT', { extra: { primary_key: 1, auto_increment: 1 } }),
    F('tajuk_kad', 'Card Title', 'VARCHAR', { required: 1 }),
    F('fk_induk', 'Parent', 'INT', { extra: { lookup_parent_table: 'induk', lookup_caption_1: 'nama_induk', lookup_display_as: 'dropdown' } }),
];
const indukExtraFields = [
    F('id', 'ID', 'INT', { extra: { primary_key: 1, auto_increment: 1 } }),
    F('catatan', 'Note', 'VARCHAR', { required: 1 }),
    F('fk_induk', 'Parent', 'INT', { extra: { lookup_parent_table: 'induk', lookup_caption_1: 'nama_induk', lookup_display_as: 'dropdown', unique: 1 } }),
];

function plainTable(tableId, name, module, fields, order) {
    return {
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
        feature_source: null, fields, custom_modules: {}, constraints: [],
    };
}

// users table comes from the existing fixture (project:create always adds it)
const baseFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'field_types_all.json'), 'utf8'));
const usersTable = JSON.parse(JSON.stringify(baseFixture.database.table.users));
usersTable.table_id = 3;

const fixture = {
    project: {
        project_id: 1, app_title: 'Form Matrix', date_format: '31 December 2026', time_format: '11:59 PM',
        language_select: 'English', timezone_select: 'Asia/Kuala_Lumpur', theme_select: 'bootstrap',
        use_3d_effects: 0, rtl: 0, compact: 0, menu_orientation: 'top', menu_at_homepage: 0,
        tables_per_row: 4, extra_wide: 0, panel_height: 100, hide_login: 0, allow_sql_tool: 0,
        allow_server_status: 0, admins_group_access: 1, allow_table_view_sql: 0, copy_children_async: 0,
        allow_pwa_install: 0, url: null, project_hook_workflow: null, stack_base: 'laravel',
        stack_database: 'sqlite', stack_theme: 'filament', data_delete_type: 'soft',
        module_auth_email: 1, module_auth_email_2fa: 0, module_auth_email_captcha: 0, module_auth_ldap: 0,
        module_auth_google_sso: 0, module_authorization: 1, module_log_audit: 0, module_fake_data: 0,
        tenancy_type: 'none', tenant_table: null, is_active: 1,
    },
    database: {
        name: 'form_matrix',
        table: {
            users: usersTable,
            watak: {
                table_id: 1, project_id: 1, table_name: 'watak', table_order: 0, module_name: 'Characters',
                table_view_title: 'Characters', table_description: null, show_quick_search: 1,
                allow_pagination: 1, pagination_type: 'simple', default_sort_by: null, sort_descending: 0,
                allow_csv_export: 1, allow_csv_import: 1, allow_print_view: 0, allow_mass_delete: 1,
                show_edit_button: 1, show_delete_button: 1, allow_restore_delete: 1, allow_force_delete: 0,
                tv_template: null, hide_field_captions: 0, use_first_field_as_title: 1,
                table_view_classes_input: null, detail_view_classes_input: null, detail_view_title: null,
                record_owner: null, owner_fk_value: null, default_focus: null, redirect_after_insert: null,
                enable_detail_view: 1, delete_with_children: 0, dv_allow_print_view: 0, dv_separate_page: 0,
                dv_hide_save_as_copy: 0, dv_sticky_buttons: 0, dv_allow_add_from_homepage: 0,
                column_grid_type: 'auto', static_grid_columns: 2, table_hook_workflow: null,
                feature_source: null, fields: parentFields, custom_modules: {}, constraints: [],
            },
            matriks: {
                table_id: 2, project_id: 1, table_name: 'matriks', table_order: 1, module_name: 'MatrixRecords',
                table_view_title: 'Matrix Records', table_description: null, show_quick_search: 1,
                allow_pagination: 1, pagination_type: 'simple', default_sort_by: null, sort_descending: 0,
                allow_csv_export: 1, allow_csv_import: 1, allow_print_view: 0, allow_mass_delete: 1,
                show_edit_button: 1, show_delete_button: 1, allow_restore_delete: 1, allow_force_delete: 0,
                tv_template: null, hide_field_captions: 0, use_first_field_as_title: 1,
                table_view_classes_input: null, detail_view_classes_input: null, detail_view_title: null,
                record_owner: null, owner_fk_value: null, default_focus: null, redirect_after_insert: null,
                enable_detail_view: 1, delete_with_children: 0, dv_allow_print_view: 0, dv_separate_page: 0,
                dv_hide_save_as_copy: 0, dv_sticky_buttons: 0, dv_allow_add_from_homepage: 0,
                column_grid_type: 'auto', static_grid_columns: 2, table_hook_workflow: null,
                feature_source: null, fields: matrixFields,
                custom_modules: [
                    {
                        module_id: 91, project_id: 1, table_id: 2,
                        module_name: 'MatriksKhas', module_order: 0, menu_icon: 'fas fa-star',
                        filter_rules: JSON.stringify({ condition: 'AND', rules: [{ column: 'id', operator: '>', value: '0' }] }),
                        included_relations: null, settings_override: null,
                        fields: [
                            { field_id: 10, is_readonly: 1 },
                            { field_id: 20, settings_override: JSON.stringify({ hide_in_tv: 1 }) },
                        ],
                    },
                ],
                constraints: [],
            },
            induk: plainTable(4, 'induk', 'Induks', indukFields, 2),
            anak: plainTable(5, 'anak', 'Anaks', anakFields, 3),
            anak_kad: plainTable(6, 'anak_kad', 'AnakKads', anakKadFields, 4),
            induk_extra: plainTable(7, 'induk_extra', 'IndukExtras', indukExtraFields, 5),
        },
        relationships: [
            {
                relationship_id: 1, parent_table_id: 1, child_table_id: 2,
                fk_child_field: 'lk_dropdown', parent_field: 'id', relationship_type: 'many-to-one',
                show_tab: 0, show_icon: 0, autoclose_modal: 0, tab_title: null, copy_records: 0,
                show_link_above: 0, show_count_in_tv: 0, allow_add_from_tv: 0,
                on_delete: 'CASCADE', on_update: 'CASCADE',
                parent_table_name: 'watak', child_table_name: 'matriks',
            },
            {
                relationship_id: 2, parent_table_id: 1, child_table_id: 2,
                fk_child_field: 'lk_radios', parent_field: 'id', relationship_type: 'many-to-one',
                show_tab: 0, show_icon: 0, autoclose_modal: 0, tab_title: null, copy_records: 0,
                show_link_above: 0, show_count_in_tv: 0, allow_add_from_tv: 0,
                on_delete: 'CASCADE', on_update: 'CASCADE',
                parent_table_name: 'watak', child_table_name: 'matriks',
            },
            {
                relationship_id: 3, parent_table_id: 4, child_table_id: 5,
                fk_child_field: 'fk_induk', parent_field: 'id', relationship_type: 'one-to-many',
                show_tab: 1, show_icon: 1, autoclose_modal: 0, tab_title: 'Children', copy_records: 0,
                show_link_above: 0, show_count_in_tv: 1, allow_add_from_tv: 0,
                on_delete: 'CASCADE', on_update: 'CASCADE',
                parent_table_name: 'induk', child_table_name: 'anak',
            },
            {
                relationship_id: 4, parent_table_id: 4, child_table_id: 6,
                fk_child_field: 'fk_induk', parent_field: 'id', relationship_type: 'one-to-many',
                show_tab: 1, show_icon: 0, autoclose_modal: 0, tab_title: 'Cards', copy_records: 0,
                show_link_above: 0, show_count_in_tv: 0, allow_add_from_tv: 0,
                on_delete: 'CASCADE', on_update: 'CASCADE',
                parent_table_name: 'induk', child_table_name: 'anak_kad',
                tv_template: 'card',
            },
            {
                relationship_id: 5, parent_table_id: 4, child_table_id: 7,
                fk_child_field: 'fk_induk', parent_field: 'id', relationship_type: 'one-to-one',
                show_tab: 1, show_icon: 0, autoclose_modal: 0, tab_title: 'OneOne', copy_records: 0,
                show_link_above: 0, show_count_in_tv: 0, allow_add_from_tv: 0,
                on_delete: 'CASCADE', on_update: 'CASCADE',
                parent_table_name: 'induk', child_table_name: 'induk_extra',
            },
            {
                relationship_id: 6, parent_table_id: 1, child_table_id: 4,
                fk_child_field: 'lk_watak', parent_field: 'id', relationship_type: 'many-to-one',
                show_tab: 0, show_icon: 0, autoclose_modal: 0, tab_title: null, copy_records: 0,
                show_link_above: 0, show_count_in_tv: 0, allow_add_from_tv: 0,
                on_delete: 'CASCADE', on_update: 'CASCADE',
                parent_table_name: 'watak', child_table_name: 'induk',
            },
        ],
        unified_menu: [],
    },
};

const out = path.join(__dirname, 'fixtures', 'form_matrix.json');
fs.writeFileSync(out, JSON.stringify(fixture, null, 2));
console.log('wrote', out, '- fields:', matrixFields.length + parentFields.length);
