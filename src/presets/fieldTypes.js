// Shared whitelists for Starter Pack manifests.
//
// FIELD_TYPES mirrors the fld-data-type select in src/index.html so a
// manifest can never declare a type the designer does not know.
// DISPLAY_TYPES mirrors the fld-display-type radios.
// NAME_RE is the safe identifier pattern for table/field names (also the
// SQL-injection guard: names are only ever used as bound VALUES, but we
// still refuse anything that is not a plain snake_case identifier).
'use strict';

const FIELD_TYPES = [
    'VARCHAR', 'TEXT', 'LONGTEXT',
    'INT', 'BIGINT', 'DECIMAL', 'BOOLEAN',
    'DATE', 'DATETIME', 'TIMESTAMP',
    'JSON', 'UUID',
];

const DISPLAY_TYPES = [
    'text_input', 'datetime_input', 'text_area', 'rich_html',
    'check_box', 'options_list', 'repeater', 'repeater_simple',
];

const NAME_RE = /^[a-z][a-z0-9_]{1,62}$/;

// Table-level settings a manifest may set. Mirrors the table:update
// whitelist in src/handlers/register.js (minus identity columns the
// installer controls itself: table_name, module_name, project_id).
const TABLE_SETTINGS_KEYS = new Set([
    'table_view_title', 'table_view_title_ms', 'table_description',
    'show_quick_search', 'allow_pagination', 'pagination_type',
    'default_sort_by', 'sort_descending',
    'allow_csv_export', 'allow_csv_import', 'allow_print_view', 'allow_mass_delete',
    'show_edit_button', 'show_delete_button', 'allow_restore_delete', 'allow_force_delete',
    'tv_template', 'card_columns', 'card_columns_tablet',
    'hide_field_captions', 'use_first_field_as_title',
    'table_view_classes_input', 'detail_view_classes_input', 'detail_view_title',
    'record_owner', 'default_focus', 'redirect_after_insert',
    'enable_detail_view', 'delete_with_children',
    'dv_allow_print_view', 'dv_separate_page', 'dv_hide_save_as_copy',
    'dv_sticky_buttons', 'dv_allow_add_from_homepage',
    'column_grid_type', 'static_grid_columns',
    'approval_enabled', 'approval_config',
    'attachments_enabled', 'public_form_enabled', 'public_form_config',
    'numbering_enabled', 'numbering_config',
    'grid_column_manager', 'grid_sticky_header', 'grid_row_density',
    'grid_inline_edit', 'grid_default_per_page', 'grid_per_page_options',
    'grid_group_by', 'grid_group_direction', 'grid_summaries', 'grid_row_click',
    'grid_empty_heading', 'grid_empty_icon', 'grid_empty_description',
    'grid_row_striping', 'grid_border_style', 'grid_content_width',
    'grid_sticky_toolbar', 'grid_sticky_footer', 'grid_column_groups',
    'grid_multi_view', 'grid_view_default', 'grid_split_view',
    'grid_calendar_enabled', 'grid_calendar_config',
    'grid_tree_enabled', 'grid_tree_config',
    'grid_kanban_enabled', 'grid_kanban_config',
    'form_layout_config',
]);

// Field-level settings a manifest may set (subset of the fields table
// columns that make sense to author declaratively).
const FIELD_SETTING_KEYS = new Set([
    'caption', 'description', 'length', 'precision', 'alignment',
    'default_value', 'read_only', 'helper_text', 'placeholder',
    'min_length', 'max_length', 'min_value', 'max_value',
    'required', 'display_type', 'unique', 'not_null', 'is_indexed',
    'boolean_label_true', 'boolean_label_false',
    'format_as', 'format_mask', 'options_list_values', 'options_display',
    'column_span_full', 'label_display', 'form_group',
    'visible_if', 'required_if_state', 'depends_on',
]);

module.exports = { FIELD_TYPES, DISPLAY_TYPES, NAME_RE, TABLE_SETTINGS_KEYS, FIELD_SETTING_KEYS };
