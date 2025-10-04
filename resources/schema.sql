-- 1. Tetapan untuk aplikasi FiziSysMaker itu sendiri
CREATE TABLE fizisys_settings (
    setting_name    TEXT PRIMARY KEY,
    setting_value   TEXT
);

-- 2. Jadual induk untuk setiap projek yang diuruskan oleh FiziSysMaker
CREATE TABLE projects (
    project_id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    app_title                    TEXT NOT NULL,
    date_order                   TEXT DEFAULT 'dmy',
    separator                    TEXT DEFAULT '/',
    char_encoding                TEXT DEFAULT 'UTF-8',
    language_select              TEXT DEFAULT 'English',
    timezone_select              TEXT DEFAULT 'Asia/Kuala_Lumpur',
    use_24hr_format              INTEGER DEFAULT 0,
    enforce_mysql_encoding       INTEGER DEFAULT 0,
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
    stack_theme                  TEXT DEFAULT 'fiziSys',
	data_delete_type             TEXT DEFAULT 'hard',
    module_auth_email            INTEGER DEFAULT 1,
    module_auth_email_2fa        INTEGER DEFAULT 0,
    module_auth_email_captcha    INTEGER DEFAULT 0,
    module_auth_ldap             INTEGER DEFAULT 0,
    module_auth_google_sso       INTEGER DEFAULT 0,
    module_authorization         INTEGER DEFAULT 1,
    module_log_audit             INTEGER DEFAULT 1,
    module_fake_data             INTEGER DEFAULT 1,
	is_active                    INTEGER DEFAULT 0
);

-- 3. Tetapan untuk setiap jadual di dalam sesebuah projek
CREATE TABLE tables (
    table_id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id                   INTEGER NOT NULL,
    table_name                   TEXT NOT NULL,
	table_order                  INTEGER,
    table_view_title             TEXT,
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
    hide_field_captions          INTEGER DEFAULT 0,
    use_first_field_as_title     INTEGER DEFAULT 0,
    table_view_classes_input     TEXT,
    detail_view_classes_input    TEXT,
    detail_view_title            TEXT DEFAULT 'Detail View',
    record_owner                 TEXT DEFAULT 'current_user',
    default_focus                TEXT,
    redirect_after_insert        TEXT,
    enable_detail_view           INTEGER DEFAULT 1,
    delete_with_children         INTEGER DEFAULT 0,
    dv_allow_print_view          INTEGER DEFAULT 1,
    dv_separate_page             INTEGER DEFAULT 0,
    dv_hide_save_as_copy         INTEGER DEFAULT 0,
    dv_sticky_buttons            INTEGER DEFAULT 1,
    dv_allow_add_from_homepage   INTEGER DEFAULT 0,
    table_hook_workflow          TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

-- 4. Tetapan terperinci untuk setiap medan di dalam sesebuah jadual
CREATE TABLE fields (
    field_id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id                     INTEGER NOT NULL,
    field_name                   TEXT NOT NULL,
	field_order                  INTEGER,
    caption                      TEXT,
    description                  TEXT,
    data_type                    TEXT,
    length                       INTEGER,
    precision                    INTEGER,
    max_chars_in_tv              INTEGER DEFAULT 50,
    alignment                    TEXT DEFAULT 'left',
    default_value                TEXT,
    read_only                    INTEGER DEFAULT 0,
    primary_key                  INTEGER DEFAULT 0,
    zero_fill                    INTEGER DEFAULT 0,
    required                     INTEGER DEFAULT 0,
    display_type                 TEXT DEFAULT 'text_input',
    auto_increment               INTEGER DEFAULT 0,
    "unique"                     INTEGER DEFAULT 0,
    is_indexed                   INTEGER DEFAULT 0,
    show_sum                     INTEGER DEFAULT 0,
    allow_sorting                INTEGER DEFAULT 1,
    tv_wrap_header               INTEGER DEFAULT 0,
    tv_wrap_text                 INTEGER DEFAULT 0,
    tv_enable_toggle             INTEGER DEFAULT 0,
    tv_description_tooltips      INTEGER DEFAULT 0,
    tv_text_limit                INTEGER DEFAULT 50,
    tv_text_size                 TEXT DEFAULT 'Normal',
    tv_font_weight               TEXT DEFAULT 'Regular',
    tv_date_time_format          TEXT DEFAULT 'M j, Y H:i:s',
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
    max_file_size                INTEGER DEFAULT 250,
    delete_image_server          INTEGER DEFAULT 0,
    dont_rename_image            INTEGER DEFAULT 0,
    tv_thumb_width               INTEGER DEFAULT 50,
    tv_thumb_height              INTEGER DEFAULT 50,
    tv_enable_zooming            INTEGER DEFAULT 0,
    tv_show_full_size            INTEGER DEFAULT 0,
    dv_thumb_width               INTEGER DEFAULT 250,
    dv_thumb_height              INTEGER DEFAULT 250,
    dv_enable_zooming            INTEGER DEFAULT 0,
    dv_show_full_size            INTEGER DEFAULT 0,
    allow_file_uploads           INTEGER DEFAULT 0,
    file_types                   TEXT DEFAULT 'images',
	file_max_size                INTEGER DEFAULT 1074,
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
    options_list_values          TEXT,
    options_display              TEXT DEFAULT 'dropdown',
    options_quick_list           TEXT,
    format_as                    TEXT DEFAULT 'default',
    calculated_enable            INTEGER DEFAULT 0,
    calculated_query             TEXT,
	lookup_custom_query          TEXT,
	algorithm_enable             INTEGER DEFAULT 0,
	algorithm_logic              TEXT,
	calculation_builder_state    TEXT,
	hook_functions               TEXT,
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
	custom_view_id  INTEGER,
    item_label      TEXT,    -- Label untuk menu custom
    item_url        TEXT,    -- URL untuk menu custom
    item_order      INTEGER,
	show_record_count INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (menu_group_id) REFERENCES menu_groups(menu_group_id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(table_id) ON DELETE CASCADE,
	FOREIGN KEY (custom_view_id) REFERENCES custom_views(custom_view_id) ON DELETE CASCADE
);

-- ADD THESE TWO NEW TABLES AT THE END OF schema.sql

-- 8. Jadual untuk menyimpan konfigurasi Custom View
CREATE TABLE custom_views (
    custom_view_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id            INTEGER NOT NULL,
    view_name           TEXT NOT NULL,
    menu_icon           TEXT,
    filter_rules        TEXT, -- Akan menyimpan konfigurasi penapis dalam format JSON
    owner_only          INTEGER DEFAULT 0, -- TAMBAH BARIS INI
    owner_field         TEXT,              -- TAMBAH BARIS INI
    view_order          INTEGER,
    FOREIGN KEY (table_id) REFERENCES tables(table_id) ON DELETE CASCADE
);

-- 9. Jadual untuk menyimpan medan-medan yang dipaparkan dalam borang Custom View
CREATE TABLE custom_view_fields (
    custom_view_field_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    custom_view_id          INTEGER NOT NULL,
    field_source_table      TEXT NOT NULL, -- cth: 'pelajar', 'kursus'
    field_source_name       TEXT NOT NULL, -- cth: 'nama_penuh', 'kod_kursus'
    field_label             TEXT,
    is_readonly             INTEGER NOT NULL DEFAULT 0,
    display_order           INTEGER,
    FOREIGN KEY (custom_view_id) REFERENCES custom_views(custom_view_id) ON DELETE CASCADE
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

-- 11. Data Awal untuk Tetapan FiziSysMaker
INSERT INTO fizisys_settings (setting_name, setting_value) VALUES
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
('lock_core_components', '1');