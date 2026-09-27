-- 1. Tetapan untuk aplikasi Fixzy SysMaker itu sendiri
CREATE TABLE fixzy_settings (
    setting_name    TEXT PRIMARY KEY,
    setting_value   TEXT
);

-- 2. Jadual induk untuk setiap projek yang diuruskan oleh Fixzy SysMaker
CREATE TABLE projects (
    project_id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    app_title                    TEXT NOT NULL,
    date_format                  TEXT DEFAULT '31/12/2025',
    time_format                  TEXT DEFAULT '11:59 PM',
    language_select              TEXT DEFAULT 'English',
    timezone_select              TEXT DEFAULT 'Asia/Kuala_Lumpur',
    theme_select                 TEXT DEFAULT 'bootstrap',
    use_3d_effects               INTEGER DEFAULT 0,
    rtl                          INTEGER DEFAULT 0,
    compact                      INTEGER DEFAULT 1,
    menu_orientation             TEXT DEFAULT 'top',
    menu_at_homepage             INTEGER DEFAULT 1,
    tables_per_row               INTEGER DEFAULT 4,
    extra_wide                   INTEGER DEFAULT 1,
    panel_height                 INTEGER DEFAULT 100,
    hide_login                   INTEGER DEFAULT 0,
    allow_sql_tool               INTEGER DEFAULT 1,
    allow_server_status          INTEGER DEFAULT 0,
    admins_group_access          INTEGER DEFAULT 1,
    allow_table_view_sql         INTEGER DEFAULT 0,
    copy_children_async          INTEGER DEFAULT 1,
    allow_pwa_install            INTEGER DEFAULT 1,
    url                          TEXT,
    project_hook_workflow        TEXT,
    stack_base                   TEXT DEFAULT 'core_php',
    stack_database               TEXT DEFAULT 'mysql_mariadb',
    stack_theme                  TEXT DEFAULT 'fixzySys',
	data_delete_type             TEXT DEFAULT 'hard',
    module_auth_email            INTEGER DEFAULT 1,
    module_auth_email_2fa        INTEGER DEFAULT 0,
    auth_2fa_mode                TEXT DEFAULT 'basic',
    module_auth_email_captcha    INTEGER DEFAULT 0,
    auth_captcha_mode            TEXT DEFAULT 'basic',
    module_auth_ldap             INTEGER DEFAULT 0,
    module_auth_google_sso       INTEGER DEFAULT 0,
    module_authorization         INTEGER DEFAULT 1,
    module_log_audit             INTEGER DEFAULT 1,
    module_log_activity          INTEGER DEFAULT 0,
    module_fake_data             INTEGER DEFAULT 1,
    module_realtime              INTEGER DEFAULT 0,
    realtime_backend             TEXT DEFAULT 'reverb', -- reverb (self-hosted) | pusher (hosted)
    module_google_sheets         INTEGER DEFAULT 0,
    module_scheduler             INTEGER DEFAULT 0,
    backup_config                TEXT,
    debug_mode                   INTEGER DEFAULT 0,
    tenancy_type                 TEXT DEFAULT 'standard', -- BARU: standard, one_to_many, many_to_many
    tenant_table                 TEXT,                    -- BARU: Nama jadual tenant (cth: fakulti, syarikat)
	is_active                    INTEGER DEFAULT 0
);

-- 3. Tetapan untuk setiap jadual di dalam sesebuah projek
CREATE TABLE tables (
    table_id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id                   INTEGER NOT NULL,
    table_name                   TEXT NOT NULL,
    module_name                  TEXT,
	table_order                  INTEGER,
    table_view_title             TEXT,
    table_view_title_ms          TEXT,
    table_description            TEXT,
    show_quick_search            INTEGER DEFAULT 1,
    allow_pagination             INTEGER DEFAULT 1,
    pagination_type              TEXT DEFAULT 'standard',
    default_sort_by              TEXT,
    sort_descending              INTEGER DEFAULT 0,
    allow_csv_export             INTEGER DEFAULT 1,
    allow_csv_import             INTEGER DEFAULT 1,
    allow_print_view             INTEGER DEFAULT 1,
    allow_mass_delete            INTEGER DEFAULT 1,
    show_edit_button             INTEGER DEFAULT 0,
    show_delete_button           INTEGER DEFAULT 0,
    allow_restore_delete         INTEGER DEFAULT 1,
    allow_force_delete           INTEGER DEFAULT 1,
    tv_template                  TEXT DEFAULT 'horizontal',
    card_columns                 INTEGER DEFAULT 3,
    card_columns_tablet          INTEGER DEFAULT 2,
    hide_field_captions          INTEGER DEFAULT 0,
    use_first_field_as_title     INTEGER DEFAULT 0,
    table_view_classes_input     TEXT,
    detail_view_classes_input    TEXT,
    detail_view_title            TEXT DEFAULT 'Detail View',
    record_owner                 TEXT,
    owner_fk_value               TEXT,
    default_focus                TEXT,
    redirect_after_insert        TEXT,
    enable_detail_view           INTEGER DEFAULT 1,
    delete_with_children         INTEGER DEFAULT 0,
    dv_allow_print_view          INTEGER DEFAULT 1,
    dv_separate_page             INTEGER DEFAULT 0,
    dv_hide_save_as_copy         INTEGER DEFAULT 0,
    dv_sticky_buttons            INTEGER DEFAULT 1,
    dv_allow_add_from_homepage   INTEGER DEFAULT 0,
    column_grid_type             TEXT DEFAULT 'dynamic',
    static_grid_columns          INTEGER DEFAULT 2,
    table_hook_workflow          TEXT,
    approval_enabled           INTEGER DEFAULT 0,
    approval_config            TEXT,
    scheduler_config           TEXT,
    attachments_enabled        INTEGER DEFAULT 0,
    public_form_enabled      INTEGER DEFAULT 0,
    public_form_config       TEXT,
    numbering_enabled      INTEGER DEFAULT 0,
    numbering_config       TEXT,
    import_enabled       INTEGER DEFAULT 0,
    import_config        TEXT,
    api_enabled          INTEGER DEFAULT 0,
    api_config           TEXT,
    feature_source               TEXT DEFAULT NULL,
    google_sync_enabled          INTEGER DEFAULT 0,
    grid_column_manager          INTEGER DEFAULT 1,
    grid_sticky_header           INTEGER DEFAULT 0,
    grid_row_density             TEXT DEFAULT 'normal',
    grid_inline_edit             INTEGER DEFAULT 0,
    grid_default_per_page        INTEGER DEFAULT 10,
    grid_per_page_options        TEXT DEFAULT '5,10,25,50',
    grid_group_by                TEXT DEFAULT '',
    grid_group_direction         TEXT DEFAULT 'asc',
    grid_summaries               TEXT DEFAULT '',
    grid_row_click               TEXT DEFAULT 'page',
    grid_empty_heading           TEXT DEFAULT '',
    grid_empty_icon              TEXT DEFAULT '',
    grid_empty_description       TEXT DEFAULT '',
    grid_row_striping            INTEGER DEFAULT 0,
    grid_border_style            TEXT DEFAULT 'default',
    grid_content_width           TEXT DEFAULT 'full',
    grid_sticky_toolbar          INTEGER DEFAULT 0,
    grid_sticky_footer           INTEGER DEFAULT 0,
    grid_column_groups           TEXT DEFAULT '',
    grid_multi_view              INTEGER DEFAULT 0,
    grid_view_default            TEXT DEFAULT 'table',
    grid_split_view              INTEGER DEFAULT 0,
    grid_calendar_enabled        INTEGER DEFAULT 0,
    grid_calendar_config         TEXT DEFAULT '',
    grid_tree_enabled            INTEGER DEFAULT 0,
    grid_tree_config             TEXT DEFAULT '',
    grid_kanban_enabled          INTEGER DEFAULT 0,
    grid_kanban_config           TEXT DEFAULT '',
    form_layout_config           TEXT DEFAULT '',
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

-- 4. Tetapan terperinci untuk setiap medan di dalam sesebuah jadual
CREATE TABLE fields (
    field_id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id                     INTEGER NOT NULL,
    field_name                   TEXT NOT NULL,
	field_order                  INTEGER,
    caption                      TEXT,
    caption_ms                   TEXT,
    description                  TEXT,
    data_type                    TEXT,
    length                       INTEGER,
    precision                    INTEGER,
    alignment                    TEXT DEFAULT 'left',
    default_value                TEXT,
    read_only                    INTEGER DEFAULT 0,
    helper_text                  TEXT,
    placeholder                  TEXT,
    min_length                   INTEGER,
    max_length                   INTEGER,
    min_value                    INTEGER,
    max_value                    INTEGER,
    primary_key                  INTEGER DEFAULT 0,
    zero_fill                    INTEGER DEFAULT 0,
    required                     INTEGER DEFAULT 0,
    display_type                 TEXT DEFAULT 'text_input',
    auto_increment               INTEGER DEFAULT 0,
    "unique"                     INTEGER DEFAULT 0,
    not_null                     INTEGER DEFAULT 0,
    is_indexed                   INTEGER DEFAULT 0,
    show_sum                     INTEGER DEFAULT 0,
    show_avg_summary             INTEGER DEFAULT 0,
    show_count_summary           INTEGER DEFAULT 0,
    show_range_summary           INTEGER DEFAULT 0,
    allow_sorting                INTEGER DEFAULT 1,
    tv_wrap_header               INTEGER DEFAULT 0,
    tv_wrap_text                 INTEGER DEFAULT 0,
    tv_enable_toggle             INTEGER DEFAULT 0,
    tv_description_tooltips      INTEGER DEFAULT 0,
    tv_text_limit                INTEGER DEFAULT 50,
    tv_text_size                 TEXT DEFAULT 'Normal',
    tv_font_weight               TEXT DEFAULT 'Regular',
    tv_date_time_format          TEXT DEFAULT 'date_and_time',
    tv_alignment                 TEXT DEFAULT 'left',
    tv_text_color                TEXT,
    tv_icon                      TEXT,
    tv_icon_color                TEXT,
    tv_currency_code             TEXT,
    unsigned                     INTEGER DEFAULT 0,
    enable_global_filter         INTEGER DEFAULT 1,
    enable_individual_filter     INTEGER DEFAULT 0,
    enable_range_filter          INTEGER DEFAULT 0,
    binary                       INTEGER DEFAULT 0,
    hide_in_tv                   INTEGER DEFAULT 0,
    editable_in_tv               INTEGER DEFAULT 0,
    hide_in_dv                   INTEGER DEFAULT 0,
    media_type                   TEXT DEFAULT 'link',
    media_link_behavior          TEXT DEFAULT 'detail_view',
    media_link_display_as        TEXT DEFAULT 'field_contents',
    media_link_other_field       TEXT,
    allow_image_uploads          INTEGER DEFAULT 0,
    image_storage_provider       TEXT DEFAULT 'local',
    max_file_size                INTEGER DEFAULT 250,
    delete_image_server          INTEGER DEFAULT 0,
    dont_rename_image            INTEGER DEFAULT 0,
    tv_thumb_shape               TEXT DEFAULT 'square',
    tv_thumb_width               INTEGER DEFAULT 50,
    tv_thumb_height              INTEGER DEFAULT 50,
    tv_enable_zooming            INTEGER DEFAULT 0,
    tv_show_full_size            INTEGER DEFAULT 0,
    dv_thumb_shape               TEXT DEFAULT 'square',
    dv_thumb_width               INTEGER DEFAULT 250,
    dv_thumb_height              INTEGER DEFAULT 250,
    dv_enable_zooming            INTEGER DEFAULT 0,
    dv_show_full_size            INTEGER DEFAULT 0,
    allow_file_uploads           INTEGER DEFAULT 0,
    file_storage_provider        TEXT DEFAULT 'local',
    file_types                   TEXT DEFAULT 'images',
	file_max_size                INTEGER DEFAULT 1074,
    attach_max_files             INTEGER DEFAULT 10,
    attach_types                 TEXT,
    attach_max_size              INTEGER DEFAULT 10240,
    delete_file_server           INTEGER DEFAULT 0,
    dont_rename_file             INTEGER DEFAULT 0,
    file_behavior                TEXT DEFAULT 'download_link',
    file_display_as              TEXT DEFAULT 'clickable_icon',
    file_other_field             TEXT,
    display_gmap                 INTEGER DEFAULT 0,
    gmap_type                    TEXT DEFAULT 'url',
    gmap_tv_width                INTEGER DEFAULT 50,
    gmap_tv_height               INTEGER DEFAULT 50,
    gmap_dv_height               INTEGER DEFAULT 360,
    accept_video_url             INTEGER DEFAULT 0,
    youtube_tv_width             INTEGER DEFAULT 50,
    youtube_tv_height            INTEGER DEFAULT 50,
    youtube_dv_width             INTEGER DEFAULT 480,
    youtube_dv_height            INTEGER DEFAULT 360,
    lookup_parent_table          TEXT,
    lookup_caption_1             TEXT,
    lookup_separator             TEXT,
    lookup_caption_2             TEXT,
    lookup_display_as            TEXT DEFAULT 'dropdown',
    lookup_inherit_permissions   INTEGER DEFAULT 0,
    lookup_link_behavior         TEXT DEFAULT 'modal',
    lookup_searchable            INTEGER DEFAULT 1,
    lookup_preload               INTEGER DEFAULT 1,
    options_list_values          TEXT,
    options_display              TEXT DEFAULT 'dropdown',
    options_quick_list           TEXT,
    boolean_label_true           TEXT DEFAULT 'Yes',
    boolean_label_false          TEXT DEFAULT 'No',
    format_as                    TEXT DEFAULT 'default',
    format_mask                  TEXT,
    off_autocomplete             INTEGER DEFAULT 0,
    column_span_full             INTEGER DEFAULT 1,
    repeater_simple_display_as   TEXT,
    repeater_simple_format_as    TEXT,
    repeater_simple_list_values  TEXT,
    repeater_1_display_as        TEXT,
    repeater_1_format_as         TEXT,
    repeater_1_list_values       TEXT,
    repeater_2_display_as        TEXT,
    repeater_2_format_as         TEXT,
    repeater_2_list_values       TEXT,
    repeater_3_display_as        TEXT,
    repeater_3_format_as         TEXT,
    repeater_3_list_values       TEXT,
    repeater_simple_required     INTEGER DEFAULT 0,
    repeater_1_required          INTEGER DEFAULT 0,
    repeater_2_required          INTEGER DEFAULT 0,
    repeater_3_required          INTEGER DEFAULT 0,
    prefix                       TEXT,
    suffix                       TEXT,
    suffix_icon                  TEXT,
    suffix_icon_color            TEXT,
    calculated_enable            INTEGER DEFAULT 0,
    calculated_query             TEXT,
	lookup_custom_query          TEXT,
	algorithm_enable             INTEGER DEFAULT 0,
	algorithm_logic              TEXT,
	calculation_builder_state    TEXT,
	hook_functions               TEXT,
    label_display                TEXT DEFAULT '',
    form_group                   TEXT DEFAULT '',
    visible_if                   TEXT DEFAULT '',
    required_if_state            TEXT DEFAULT '',
    depends_on                   TEXT DEFAULT '',
    FOREIGN KEY (table_id) REFERENCES tables(table_id) ON DELETE CASCADE
);

-- 5. Jadual untuk hubungan Parent-Child antara jadual
CREATE TABLE parent_child_relationships (
    relationship_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_table_id   INTEGER NOT NULL,
    child_table_id    INTEGER NOT NULL,
	fk_child_field    TEXT NOT NULL,
	parent_field      TEXT NOT NULL,
    relationship_type TEXT DEFAULT 'one-to-many',
    show_tab          INTEGER DEFAULT 1,
    show_icon         INTEGER DEFAULT 1,
    autoclose_modal   INTEGER DEFAULT 0,
    tab_title         TEXT,
    copy_records      INTEGER DEFAULT 0,
    show_link_above   INTEGER DEFAULT 1,
    show_count_in_tv  INTEGER DEFAULT 0,
    allow_add_from_tv INTEGER DEFAULT 0,
    tv_template       TEXT DEFAULT '',
    card_columns      INTEGER DEFAULT 0,
    form_style        TEXT DEFAULT '',
    on_delete         TEXT DEFAULT 'NO ACTION', -- Tambah ini (CASCADE, SET NULL, RESTRICT, NO ACTION)
    on_update         TEXT DEFAULT 'NO ACTION', -- Tambah ini
    FOREIGN KEY (parent_table_id) REFERENCES tables(table_id) ON DELETE CASCADE,
    FOREIGN KEY (child_table_id) REFERENCES tables(table_id) ON DELETE CASCADE
);

-- 6. Jadual untuk Kumpulan Menu
CREATE TABLE menu_groups (
    menu_group_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL,
    group_name      TEXT NOT NULL,
    group_order     INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

-- 7. Jadual untuk SEMUA Item Menu (Akan datang termasuk individu)
CREATE TABLE menu_items (
    item_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL,
    menu_group_id   INTEGER, -- Akan NULL untuk menu individu
    table_id        INTEGER, -- NULL untuk menu custom
	module_id       INTEGER,
    item_label      TEXT,
    item_detail     TEXT,
    item_order      INTEGER,
	show_record_count INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (menu_group_id) REFERENCES menu_groups(menu_group_id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(table_id) ON DELETE CASCADE,
	FOREIGN KEY (module_id) REFERENCES custom_modules(module_id) ON DELETE CASCADE
);

-- 8. Jadual untuk menyimpan konfigurasi Custom Module
CREATE TABLE custom_modules (
    module_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    table_id INTEGER NOT NULL,            -- Merujuk kepada jadual fizikal asal
    module_name TEXT NOT NULL,            -- Nama unik untuk modul ini (cth: 'Pengurusan Staf Aktif')
    module_order INTEGER DEFAULT 0,
    menu_icon TEXT,
    filter_rules TEXT,                    -- Logik tapisan data (jika ada)
    included_relations TEXT,              -- Hubungan yang dibawa bersama
    settings_override TEXT,               -- BARU: JSON string untuk menimpa tetapan jadual asal
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(table_id) ON DELETE CASCADE
);

-- 9. Jadual untuk menyimpan medan-medan yang dipaparkan dalam borang Custom Module
CREATE TABLE custom_module_fields (
    module_field_id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER NOT NULL,
    field_id INTEGER NOT NULL,            -- Merujuk kepada medan fizikal asal
    is_readonly INTEGER DEFAULT 0,        -- Kekal untuk keserasian, atau boleh dipindahkan ke settings_override
    settings_override TEXT,               -- BARU: JSON string untuk menimpa tetapan medan asal (cth: caption, required)
    display_order	INTEGER DEFAULT 0,
    FOREIGN KEY (module_id) REFERENCES custom_modules(module_id) ON DELETE CASCADE,
    FOREIGN KEY (field_id) REFERENCES fields(field_id) ON DELETE CASCADE
);

-- 10. Jadual untuk menyimpan definisi kekangan peringkat jadual
CREATE TABLE table_constraints (
    constraint_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id        INTEGER NOT NULL,
    constraint_name TEXT,
    constraint_type TEXT NOT NULL, -- 'UNIQUE' atau 'PRIMARY KEY'
    columns         TEXT NOT NULL, -- JSON array of column names
    FOREIGN KEY (table_id) REFERENCES tables(table_id) ON DELETE CASCADE
);

-- 11. Data Awal untuk Tetapan Fixzy SysMaker
INSERT INTO fixzy_settings (setting_name, setting_value) VALUES
('check_updates', '1'),
('autosave_interval', '15'),
('show_begin_box', '1'),
('font_size', 'small'),
('doc_root', ''),
('base_url', 'http://localhost'),
('field_default_type', 'VARCHAR'),
('field_default_length', '255'),
('table_suggest_icon', '1'),
('table_allow_csv', '1'),
('table_dv_separate_page', '1'),
('table_hide_save_as_copy', '0'),
('table_allow_add_from_homepage', '0'),
('table_show_record_count', '0'),
('project_encoding', '3-Byte Unicode UTF-8'),
('project_rtl', '0'),
('project_doxygen', '1'),
('project_hide_footer', '0'),
('max_entries', '150'),
('project_no_trim', '0'),
('lock_core_components', '1'),
-- Global layout defaults (applied to new tables automatically; existing
-- tables only when the user clicks "Apply" in Preferences).
('global_tv_template', 'horizontal'),
('global_card_columns', '3'),
('global_form_layout_config', '');

-- TABEL BARU: Menyimpan peraturan validasi untuk setiap column
CREATE TABLE IF NOT EXISTS field_validations (
    validation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    column_id INTEGER NOT NULL,
    rule_type TEXT NOT NULL, -- Contoh: 'active_url', 'after', 'prohibited_if', 'not_in'
    rule_value_1 TEXT,       -- Parameter 1 (Contoh: nama field rujukan)
    rule_value_2 TEXT,       -- Parameter 2 (Contoh: nilai rujukan)
    is_active INTEGER DEFAULT 0,
    FOREIGN KEY (column_id) REFERENCES fields(field_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    widget_type TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_field TEXT,
    aggregate_type TEXT,
    width_span TEXT DEFAULT '1',
    icon TEXT,                        -- Cth: 'heroicon-o-users' (Untuk Stats)
    color TEXT DEFAULT 'primary',     -- Cth: 'primary', 'success', 'danger', 'warning', 'info'
    sort_order INTEGER DEFAULT 0,
    chart_label_column TEXT,      -- Untuk Paksi-X Carta (Cth: 'nama_fakulti')
    filter_field TEXT,            -- Lajur untuk klausa WHERE (Cth: 'status')
    filter_operator TEXT,         -- Operasi (Cth: '=', '!=', '>', 'LIKE')
    filter_value TEXT,            -- Nilai tapisan (Cth: 'aktif')
    timeframe_range TEXT,         -- Tapisan masa (Cth: 'this_month', 'this_year')
    advanced_query TEXT,          -- BARU: Untuk simpan JSON/SQL dari Query Builder
    chart_series_field TEXT,      -- 2nd numeric field (scatter Y / combo line overlay)
    chart_size_field TEXT,        -- Bubble size field (chart_bubble only)
    series_aggregate_type TEXT,   -- Aggregate for the combo line series
    refresh_mode TEXT DEFAULT 'static',  -- 'static' | 'poll' | 'live'
    refresh_interval INTEGER DEFAULT 10, -- Poll interval in seconds (poll mode)
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

-- Kiosk display mode (2026-09-26): wall/TV dashboard presentation.
-- Lives on the project; widgets are shared with the admin dashboard.
ALTER TABLE projects ADD COLUMN kiosk_enabled INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN kiosk_rotate_seconds INTEGER DEFAULT 15;
ALTER TABLE projects ADD COLUMN kiosk_page_size INTEGER DEFAULT 4;

-- Theme system v1 (2026-09-27): stack-neutral theme config on the project.
-- JSON: { mode: 'preset'|'custom', preset: 'fixzy-amber'|'fixzy-emerald'|
--         'fixzy-slate', primary: '#rrggbb' (custom only), name: '...' }
-- The legacy theme_select (Bootswatch names) is no longer written by the
-- UI; kept only for backward-compatible reads of old databases.
ALTER TABLE projects ADD COLUMN theme_config TEXT DEFAULT '';

-- User-defined themes reusable across projects (global store).
CREATE TABLE IF NOT EXISTS saved_themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    primary_hex TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);