BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "custom_module_fields" (
	"module_field_id"	INTEGER,
	"module_id"	INTEGER NOT NULL,
	"field_id"	INTEGER NOT NULL,
	"is_readonly"	INTEGER DEFAULT 0,
	"settings_override"	TEXT,
	"display_order"	INTEGER DEFAULT 0,
	PRIMARY KEY("module_field_id" AUTOINCREMENT),
	FOREIGN KEY("field_id") REFERENCES "fields"("field_id") ON DELETE CASCADE,
	FOREIGN KEY("module_id") REFERENCES "custom_modules"("module_id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "custom_modules" (
	"module_id"	INTEGER,
	"project_id"	INTEGER NOT NULL,
	"table_id"	INTEGER NOT NULL,
	"module_name"	TEXT NOT NULL,
	"module_order"	INTEGER DEFAULT 0,
	"menu_icon"	TEXT,
	"filter_rules"	TEXT,
	"included_relations"	TEXT,
	"settings_override"	TEXT,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("module_id" AUTOINCREMENT),
	FOREIGN KEY("project_id") REFERENCES "projects"("project_id") ON DELETE CASCADE,
	FOREIGN KEY("table_id") REFERENCES "tables"("table_id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "field_validations" (
	"validation_id"	INTEGER,
	"column_id"	INTEGER NOT NULL,
	"rule_type"	TEXT NOT NULL,
	"rule_value_1"	TEXT,
	"rule_value_2"	TEXT,
	"is_active"	INTEGER DEFAULT 0,
	PRIMARY KEY("validation_id" AUTOINCREMENT),
	FOREIGN KEY("column_id") REFERENCES "fields"("field_id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "fields" (
	"field_id"	INTEGER,
	"table_id"	INTEGER NOT NULL,
	"field_name"	TEXT NOT NULL,
	"field_order"	INTEGER,
	"caption"	TEXT,
	"description"	TEXT,
	"data_type"	TEXT,
	"length"	INTEGER,
	"precision"	INTEGER,
	"max_chars_in_tv"	INTEGER DEFAULT 50,
	"alignment"	TEXT DEFAULT 'left',
	"default_value"	TEXT,
	"read_only"	INTEGER DEFAULT 0,
	"primary_key"	INTEGER DEFAULT 0,
	"zero_fill"	INTEGER DEFAULT 0,
	"required"	INTEGER DEFAULT 0,
	"display_type"	TEXT DEFAULT 'text_input',
	"auto_increment"	INTEGER DEFAULT 0,
	"unique"	INTEGER DEFAULT 0,
	"is_indexed"	INTEGER DEFAULT 0,
	"show_sum"	INTEGER DEFAULT 0,
	"allow_sorting"	INTEGER DEFAULT 1,
	"tv_wrap_header"	INTEGER DEFAULT 0,
	"tv_wrap_text"	INTEGER DEFAULT 0,
	"tv_enable_toggle"	INTEGER DEFAULT 0,
	"tv_description_tooltips"	INTEGER DEFAULT 0,
	"tv_text_limit"	INTEGER DEFAULT 50,
	"tv_text_size"	TEXT DEFAULT 'Normal',
	"tv_font_weight"	TEXT DEFAULT 'Regular',
	"tv_date_time_format"	TEXT DEFAULT 'date_and_time',
	"tv_alignment"	TEXT DEFAULT 'left',
	"tv_text_color"	TEXT,
	"tv_icon"	TEXT,
	"tv_icon_color"	TEXT,
	"tv_currency_code"	TEXT,
	"unsigned"	INTEGER DEFAULT 0,
	"enable_global_filter"	INTEGER DEFAULT 1,
	"enable_individual_filter"	INTEGER DEFAULT 0,
	"enable_range_filter"	INTEGER DEFAULT 0,
	"binary"	INTEGER DEFAULT 0,
	"hide_in_tv"	INTEGER DEFAULT 0,
	"editable_in_tv"	INTEGER DEFAULT 0,
	"hide_in_dv"	INTEGER DEFAULT 0,
	"media_type"	TEXT DEFAULT 'link',
	"media_link_behavior"	TEXT DEFAULT 'detail_view',
	"media_link_display_as"	TEXT DEFAULT 'field_contents',
	"media_link_other_field"	TEXT,
	"allow_image_uploads"	INTEGER DEFAULT 0,
	"image_storage_provider"	TEXT DEFAULT 'local',
	"max_file_size"	INTEGER DEFAULT 250,
	"delete_image_server"	INTEGER DEFAULT 0,
	"dont_rename_image"	INTEGER DEFAULT 0,
	"tv_thumb_shape"	TEXT DEFAULT 'square',
	"tv_thumb_width"	INTEGER DEFAULT 50,
	"tv_thumb_height"	INTEGER DEFAULT 50,
	"tv_enable_zooming"	INTEGER DEFAULT 0,
	"tv_show_full_size"	INTEGER DEFAULT 0,
	"dv_thumb_shape"	TEXT DEFAULT 'square',
	"dv_thumb_width"	INTEGER DEFAULT 250,
	"dv_thumb_height"	INTEGER DEFAULT 250,
	"dv_enable_zooming"	INTEGER DEFAULT 0,
	"dv_show_full_size"	INTEGER DEFAULT 0,
	"allow_file_uploads"	INTEGER DEFAULT 0,
	"file_storage_provider"	TEXT DEFAULT 'local',
	"file_types"	TEXT DEFAULT 'images',
	"file_max_size"	INTEGER DEFAULT 1074,
	"delete_file_server"	INTEGER DEFAULT 0,
	"dont_rename_file"	INTEGER DEFAULT 0,
	"file_behavior"	TEXT DEFAULT 'download_link',
	"file_display_as"	TEXT DEFAULT 'clickable_icon',
	"file_other_field"	TEXT,
	"display_gmap"	INTEGER DEFAULT 0,
	"gmap_type"	TEXT DEFAULT 'url',
	"gmap_tv_width"	INTEGER DEFAULT 50,
	"gmap_tv_height"	INTEGER DEFAULT 50,
	"gmap_dv_height"	INTEGER DEFAULT 360,
	"accept_video_url"	INTEGER DEFAULT 0,
	"youtube_tv_width"	INTEGER DEFAULT 50,
	"youtube_tv_height"	INTEGER DEFAULT 50,
	"youtube_dv_width"	INTEGER DEFAULT 480,
	"youtube_dv_height"	INTEGER DEFAULT 360,
	"lookup_parent_table"	TEXT,
	"lookup_caption_1"	TEXT,
	"lookup_separator"	TEXT,
	"lookup_caption_2"	TEXT,
	"lookup_display_as"	TEXT DEFAULT 'dropdown',
	"lookup_inherit_permissions"	INTEGER DEFAULT 0,
	"lookup_link_behavior"	TEXT DEFAULT 'modal',
	"options_list_values"	TEXT,
	"options_display"	TEXT DEFAULT 'dropdown',
	"options_quick_list"	TEXT,
	"format_as"	TEXT DEFAULT 'default',
	"calculated_enable"	INTEGER DEFAULT 0,
	"calculated_query"	TEXT,
	"lookup_custom_query"	TEXT,
	"algorithm_enable"	INTEGER DEFAULT 0,
	"algorithm_logic"	TEXT,
	"calculation_builder_state"	TEXT,
	"hook_functions"	TEXT,
	"show_avg_summary"	INTEGER,
	"show_count_summary"	INTEGER,
	"show_range_summary"	INTEGER,
	"format_mask"	INTEGER,
	"helper_text"	TEXT,
	"placeholder"	TEXT,
	"min_length"	INTEGER,
	"max_length"	INTEGER,
	"min_value"	INTEGER,
	"max_value"	INTEGER,
	"off_autocomplete"	TEXT DEFAULT 0,
	"column_span_full"	NUMERIC DEFAULT 1,
	"lookup_searchable"	INTEGER DEFAULT 1,
	"lookup_preload"	INTEGER DEFAULT 1,
	"prefix"	TEXT,
	"suffix"	TEXT,
	"suffix_icon"	TEXT,
	"suffix_icon_color"	TEXT,
	"repeater_simple_display_as"	TEXT,
	"repeater_simple_format_as"	TEXT,
	"repeater_simple_list_values"	TEXT,
	"repeater_1_display_as"	TEXT,
	"repeater_1_format_as"	TEXT,
	"repeater_1_list_values"	TEXT,
	"repeater_2_display_as"	TEXT,
	"repeater_2_format_as"	TEXT,
	"repeater_2_list_values"	TEXT,
	"repeater_3_display_as"	TEXT,
	"repeater_3_format_as"	TEXT,
	"repeater_3_list_values"	TEXT,
	"repeater_simple_required"	INTEGER DEFAULT 0,
	"repeater_1_required"	INTEGER DEFAULT 0,
	"repeater_2_required"	INTEGER DEFAULT 0,
	"repeater_3_required"	INTEGER DEFAULT 0,
	"boolean_label_true"	TEXT DEFAULT 'Yes',
	"boolean_label_false"	TEXT DEFAULT 'No',
	"not_null"	INTEGER DEFAULT 0,
	PRIMARY KEY("field_id" AUTOINCREMENT),
	FOREIGN KEY("table_id") REFERENCES "tables"("table_id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "fixzy_settings" (
	"setting_name"	TEXT,
	"setting_value"	TEXT,
	PRIMARY KEY("setting_name")
);
CREATE TABLE IF NOT EXISTS "menu_groups" (
	"menu_group_id"	INTEGER,
	"project_id"	INTEGER NOT NULL,
	"group_name"	TEXT NOT NULL,
	"group_order"	INTEGER,
	PRIMARY KEY("menu_group_id" AUTOINCREMENT),
	FOREIGN KEY("project_id") REFERENCES "projects"("project_id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "menu_items" (
	"item_id"	INTEGER,
	"project_id"	INTEGER NOT NULL,
	"menu_group_id"	INTEGER,
	"table_id"	INTEGER,
	"module_id"	INTEGER,
	"item_label"	TEXT,
	"item_detail"	TEXT,
	"item_order"	INTEGER,
	"show_record_count"	INTEGER DEFAULT 0,
	PRIMARY KEY("item_id" AUTOINCREMENT),
	FOREIGN KEY("menu_group_id") REFERENCES "menu_groups"("menu_group_id") ON DELETE CASCADE,
	FOREIGN KEY("module_id") REFERENCES "custom_modules"("module_id") ON DELETE CASCADE,
	FOREIGN KEY("project_id") REFERENCES "projects"("project_id") ON DELETE CASCADE,
	FOREIGN KEY("table_id") REFERENCES "tables"("table_id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "parent_child_relationships" (
	"relationship_id"	INTEGER,
	"parent_table_id"	INTEGER NOT NULL,
	"child_table_id"	INTEGER NOT NULL,
	"fk_child_field"	TEXT NOT NULL,
	"parent_field"	TEXT NOT NULL,
	"relationship_type"	TEXT DEFAULT 'one-to-many',
	"show_tab"	INTEGER DEFAULT 1,
	"show_icon"	INTEGER DEFAULT 1,
	"autoclose_modal"	INTEGER DEFAULT 0,
	"tab_title"	TEXT,
	"copy_records"	INTEGER DEFAULT 0,
	"show_link_above"	INTEGER DEFAULT 1,
	"show_count_in_tv"	INTEGER DEFAULT 0,
	"allow_add_from_tv"	INTEGER DEFAULT 0,
	"on_delete"	TEXT DEFAULT 'NO ACTION',
	"on_update"	TEXT DEFAULT 'NO ACTION',
	PRIMARY KEY("relationship_id" AUTOINCREMENT),
	FOREIGN KEY("child_table_id") REFERENCES "tables"("table_id") ON DELETE CASCADE,
	FOREIGN KEY("parent_table_id") REFERENCES "tables"("table_id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "projects" (
	"project_id"	INTEGER,
	"app_title"	TEXT NOT NULL,
	"date_format"	TEXT DEFAULT '31/12/2025',
	"time_format"	TEXT DEFAULT '11:59 PM',
	"language_select"	TEXT DEFAULT 'English',
	"timezone_select"	TEXT DEFAULT 'Asia/Kuala_Lumpur',
	"theme_select"	TEXT DEFAULT 'bootstrap',
	"use_3d_effects"	INTEGER DEFAULT 0,
	"rtl"	INTEGER DEFAULT 0,
	"compact"	INTEGER DEFAULT 1,
	"menu_orientation"	TEXT DEFAULT 'top',
	"menu_at_homepage"	INTEGER DEFAULT 1,
	"tables_per_row"	INTEGER DEFAULT 4,
	"extra_wide"	INTEGER DEFAULT 1,
	"panel_height"	INTEGER DEFAULT 100,
	"hide_login"	INTEGER DEFAULT 0,
	"allow_sql_tool"	INTEGER DEFAULT 1,
	"allow_server_status"	INTEGER DEFAULT 0,
	"admins_group_access"	INTEGER DEFAULT 1,
	"allow_table_view_sql"	INTEGER DEFAULT 0,
	"copy_children_async"	INTEGER DEFAULT 1,
	"allow_pwa_install"	INTEGER DEFAULT 1,
	"url"	TEXT,
	"project_hook_workflow"	TEXT,
	"stack_base"	TEXT DEFAULT 'core_php',
	"stack_database"	TEXT DEFAULT 'mysql_mariadb',
	"stack_theme"	TEXT DEFAULT 'fixzySys',
	"data_delete_type"	TEXT DEFAULT 'hard',
	"module_auth_email"	INTEGER DEFAULT 1,
	"module_auth_email_2fa"	INTEGER DEFAULT 0,
	"module_auth_email_captcha"	INTEGER DEFAULT 0,
	"module_auth_ldap"	INTEGER DEFAULT 0,
	"module_auth_google_sso"	INTEGER DEFAULT 0,
	"module_authorization"	INTEGER DEFAULT 1,
	"module_log_audit"	INTEGER DEFAULT 1,
	"module_fake_data"	INTEGER DEFAULT 1,
	"tenancy_type"	TEXT DEFAULT 'standard',
	"tenant_table"	TEXT,
	"is_active"	INTEGER DEFAULT 0,
	PRIMARY KEY("project_id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "table_constraints" (
	"constraint_id"	INTEGER,
	"table_id"	INTEGER NOT NULL,
	"constraint_name"	TEXT,
	"constraint_type"	TEXT NOT NULL,
	"columns"	TEXT NOT NULL,
	PRIMARY KEY("constraint_id" AUTOINCREMENT),
	FOREIGN KEY("table_id") REFERENCES "tables"("table_id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "tables" (
	"table_id"	INTEGER,
	"project_id"	INTEGER NOT NULL,
	"table_name"	TEXT NOT NULL,
	"table_order"	INTEGER,
	"module_name"	TEXT,
	"table_view_title"	TEXT,
	"table_description"	TEXT,
	"show_quick_search"	INTEGER DEFAULT 1,
	"allow_pagination"	INTEGER DEFAULT 1,
	"pagination_type"	TEXT DEFAULT 'standard',
	"default_sort_by"	TEXT,
	"sort_descending"	INTEGER DEFAULT 0,
	"allow_csv_export"	INTEGER DEFAULT 1,
	"allow_csv_import"	INTEGER DEFAULT 1,
	"allow_print_view"	INTEGER DEFAULT 1,
	"allow_mass_delete"	INTEGER DEFAULT 1,
	"show_edit_button"	INTEGER DEFAULT 0,
	"show_delete_button"	INTEGER DEFAULT 0,
	"allow_restore_delete"	INTEGER DEFAULT 1,
	"allow_force_delete"	INTEGER DEFAULT 1,
	"tv_template"	TEXT DEFAULT 'horizontal',
	"hide_field_captions"	INTEGER DEFAULT 0,
	"use_first_field_as_title"	INTEGER DEFAULT 0,
	"table_view_classes_input"	TEXT,
	"detail_view_classes_input"	TEXT,
	"detail_view_title"	TEXT DEFAULT 'Detail View',
	"record_owner"	TEXT,
	"owner_fk_value"	TEXT,
	"default_focus"	TEXT,
	"redirect_after_insert"	TEXT,
	"enable_detail_view"	INTEGER DEFAULT 1,
	"delete_with_children"	INTEGER DEFAULT 0,
	"dv_allow_print_view"	INTEGER DEFAULT 1,
	"dv_separate_page"	INTEGER DEFAULT 0,
	"dv_hide_save_as_copy"	INTEGER DEFAULT 0,
	"dv_sticky_buttons"	INTEGER DEFAULT 1,
	"dv_allow_add_from_homepage"	INTEGER DEFAULT 0,
	"column_grid_type"	TEXT DEFAULT 'dynamic',
	"static_grid_columns"	INTEGER DEFAULT 2,
	"table_hook_workflow"	TEXT,
	"feature_source"	TEXT,
	PRIMARY KEY("table_id" AUTOINCREMENT),
	FOREIGN KEY("project_id") REFERENCES "projects"("project_id") ON DELETE CASCADE
);
INSERT INTO "custom_module_fields" VALUES (106,14,333,0,'{"lookup_display_as":"dropdown","format_as":"default"}',0);
INSERT INTO "custom_modules" VALUES (3,1,42,'New Pendaftaran Kursus',0,'fas fa-table','{"condition":"OR","rules":[{"column":"gred","operator":"=","value":"A"},{"column":"gred","operator":"=","value":"B"}]}',NULL,'{"table_view_title":"Pelajar Kursus Test"}','2026-02-15 11:42:13','2026-02-15 11:42:13');
INSERT INTO "custom_modules" VALUES (14,1,38,'PelajarTest',0,'fas fa-box','{"condition":"AND","rules":[{"column":"id","operator":">","value":"1"}]}',NULL,'{"table_view_title":"Pelajar Kursus"}','2026-02-22 07:17:18','2026-02-22 07:17:18');
INSERT INTO "fields" VALUES (1,1,'id',0,'ID',NULL,'BIGINT',20,NULL,50,'left',NULL,1,1,0,0,'text_input',1,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,1,1,0,0,0,1,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (2,1,'name',1,'Name',NULL,'VARCHAR',255,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (3,1,'email',2,'Email',NULL,'VARCHAR',255,NULL,50,'left',NULL,0,0,0,1,'text_input',0,1,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (4,1,'email_verified_at',3,'Email Verified At',NULL,'TIMESTAMP',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (5,1,'password',4,'Password',NULL,'VARCHAR',255,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (6,1,'remember_token',5,'Remember Token',NULL,'VARCHAR',100,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (7,1,'created_at',13,'Created At',NULL,'TIMESTAMP',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (8,1,'updated_at',14,'Updated At',NULL,'TIMESTAMP',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (9,1,'deleted_at',15,'Deleted At',NULL,'TIMESTAMP',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (63,38,'surat_tawaran',7,'Surat Tawaran',NULL,'VARCHAR',255,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,'document-arrow-down','primary',NULL,0,1,0,0,0,0,0,0,'upload','detail_view','field_contents',NULL,1,'public',250,0,0,'square',50,50,1,0,'square',250,250,0,0,1,'public','image/jpeg,image/jpeg,application/pdf',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,'',NULL,NULL,'',NULL,NULL,'',NULL,NULL,'',NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (64,42,'dokumen_lengkap',5,'Dokumen Lengkap',NULL,'BOOLEAN',255,NULL,50,'left',NULL,0,0,0,0,'options_list',0,0,0,0,1,1,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,'',NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,'',NULL,NULL,'',NULL,NULL,'',NULL,NULL,'',NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (65,41,'lokasi_kelas',17,'Lokasi Kelas','Show youtube video/google maps location','VARCHAR',255,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,1,50,'Normal','Regular','date_and_time','center',NULL,'map-pin','danger',NULL,0,1,0,0,0,0,0,0,'gmap','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,1,'url',50,50,360,1,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,'',NULL,NULL,'',NULL,NULL,'',NULL,NULL,'',NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (66,41,'youtube_intro',18,'Youtube Intro','Show youtube video','VARCHAR',255,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,1,50,'Normal','Regular','date_and_time','center',NULL,'video-camera','danger',NULL,0,1,0,0,0,0,0,0,'youtube','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,1,'url',50,50,360,1,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (332,38,'id',0,'Id',NULL,'INT',11,NULL,50,'left',NULL,1,1,0,0,'text_input',1,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (333,38,'nama_penuh',2,'Nama Penuh','Papar nama penuh pelajar','VARCHAR',150,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,0,0,1,0,1,0,1,50,'Normal','Bold','date_and_time','center',NULL,NULL,NULL,NULL,0,1,1,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,'[]',NULL,NULL,NULL,NULL,NULL,NULL,'Isikan nama penuh seperti didalam kad pengenalan',NULL,NULL,150,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (334,38,'no_matrik',3,'No Matrik',NULL,'VARCHAR',20,NULL,50,'left',NULL,0,0,0,1,'text_input',0,1,0,0,1,0,0,0,0,50,'Large','Regular','date_and_time','left','primary',NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (335,38,'email',4,'Email',NULL,'JSON',100,NULL,50,'left',NULL,0,0,0,1,'repeater_simple',0,1,0,0,0,0,1,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,'text_input','email',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (336,38,'tarikh_daftar',5,'Tarikh Daftar',NULL,'DATE',NULL,NULL,50,'left','NULL',0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (337,38,'gambar_profil',6,'Gambar Profil',NULL,'VARCHAR',255,NULL,50,'left','NULL',0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'image','detail_view','field_contents',NULL,1,'public',250,0,0,'square',50,50,1,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (338,39,'id',0,'Id',NULL,'INT',11,NULL,50,'left',NULL,1,1,0,0,'text_input',1,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (339,39,'pelajar_id',1,'Pelajar Id',NULL,'INT',11,NULL,50,'left',NULL,0,0,0,1,'text_input',0,1,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,'pelajar','nama_penuh',NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (340,39,'alamat',2,'Alamat',NULL,'TEXT',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (341,39,'no_telefon',3,'No Telefon',NULL,'VARCHAR',20,NULL,50,'left','NULL',0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (342,39,'tarikh_lahir',4,'Tarikh Lahir',NULL,'DATE',NULL,NULL,50,'left','NULL',0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (343,39,'info_kecemasan',5,'Info Kecemasan',NULL,'VARCHAR',200,NULL,50,'left','NULL',0,0,0,0,'options_list',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal','Primary;;Secondary;;Diploma;;Degree;;Masters;;PhD','dropdown','Primary;;Secondary;;Diploma;;Degree;;Masters;;PhD','default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (344,40,'id',0,'Id',NULL,'INT',11,NULL,50,'left',NULL,1,1,0,0,'text_input',1,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (345,40,'pelajar_id',1,'Pelajar Id',NULL,'INT',11,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,'pelajar','nama_penuh',NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (346,40,'nama_fail',2,'Nama Fail',NULL,'VARCHAR',200,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (347,40,'path_fail',3,'Path Fail',NULL,'VARCHAR',255,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (348,40,'jenis_dokumen',4,'Jenis Dokumen',NULL,'VARCHAR',50,NULL,50,'left','Am',0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (349,40,'tarikh_muatnaik',5,'Tarikh Muatnaik',NULL,'TIMESTAMP',NULL,NULL,50,'left','CURRENT_TIMESTAMP',0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (350,41,'id',0,'Id',NULL,'INT',11,NULL,50,'left',NULL,1,1,0,0,'text_input',1,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (351,41,'nama_kursus',1,'Nama Kursus',NULL,'VARCHAR',150,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (352,41,'kod_kursus',2,'Kod Kursus',NULL,'VARCHAR',10,NULL,50,'left',NULL,0,0,0,1,'text_input',0,1,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (353,41,'deskripsi',3,'Deskripsi',NULL,'TEXT',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,1,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (354,41,'jam_kredit',4,'Jam Kredit',NULL,'INT',2,NULL,50,'left','3',0,0,0,0,'text_input',0,0,0,1,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (355,41,'prasyarat_kursus_id',5,'Prasyarat Kursus Id',NULL,'INT',11,NULL,50,'left','NULL',0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,'kursus','nama_kursus',NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (356,42,'id',0,'Id',NULL,'INT',11,NULL,50,'left',NULL,1,1,0,0,'text_input',1,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (357,42,'pelajar_id',1,'Pelajar Id',NULL,'INT',11,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,'pelajar','nama_penuh',NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (358,42,'kursus_id',2,'Kursus Id',NULL,'INT',11,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,'kursus','nama_kursus',NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (359,42,'tarikh_pendaftaran',3,'Tarikh Pendaftaran',NULL,'DATETIME',NULL,NULL,50,'left','CURRENT_TIMESTAMP',0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (360,42,'gred',4,'Gred',NULL,'VARCHAR',5,NULL,50,'left','NULL',0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (361,43,'id',0,'Id',NULL,'INT',11,NULL,50,'left',NULL,1,1,0,0,'text_input',1,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (362,43,'pendaftaran_id',1,'Pendaftaran Id',NULL,'INT',11,NULL,50,'left',NULL,0,0,0,1,'text_input',0,1,1,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,'pendaftaran_kursus','tarikh_pendaftaran',NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (363,43,'user_id',2,'User Id',NULL,'INT',11,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,1,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,'users','name','',NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (364,43,'status',3,'Status',NULL,'VARCHAR',15,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (365,43,'catatan',4,'Catatan',NULL,'TEXT',NULL,NULL,50,'left','NULL',0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (366,43,'tarikh_tindakan',5,'Tarikh Tindakan',NULL,'DATETIME',NULL,NULL,50,'left','CURRENT_TIMESTAMP',0,0,0,1,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',1);
INSERT INTO "fields" VALUES (367,38,'created_at',19,'Created At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (368,38,'updated_at',20,'Updated At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (369,38,'deleted_at',21,'Deleted At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (370,39,'created_at',6,'Created At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (371,39,'updated_at',7,'Updated At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (372,39,'deleted_at',8,'Deleted At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (373,40,'created_at',6,'Created At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (374,40,'updated_at',7,'Updated At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (375,40,'deleted_at',8,'Deleted At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (376,41,'created_at',17,'Created At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (377,41,'updated_at',18,'Updated At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (378,41,'deleted_at',19,'Deleted At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (379,42,'created_at',5,'Created At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (380,42,'updated_at',6,'Updated At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (381,42,'deleted_at',7,'Deleted At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (382,43,'created_at',6,'Created At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (383,43,'updated_at',7,'Updated At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (384,43,'deleted_at',8,'Deleted At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (385,44,'id',0,'ID',NULL,'INT',11,NULL,50,'left',NULL,1,1,0,0,'text_input',1,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,1,1,0,0,0,1,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (386,44,'created_at',2,'Created At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (387,44,'updated_at',3,'Updated At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (388,44,'deleted_at',4,'Deleted At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (389,44,'nama_fakulti',1,'Nama Fakulti',NULL,'VARCHAR',255,NULL,50,'left',NULL,0,0,0,1,'text_input',0,0,0,0,1,0,0,0,0,50,'Medium','Regular','date_and_time','center','success',NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (390,38,'fakulti_id',1,'Id Fakulti',NULL,'INT',255,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,'fakulti','nama_fakulti',NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (391,45,'id',0,'ID',NULL,'INT',11,NULL,50,'left',NULL,1,1,0,0,'text_input',1,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,1,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (392,45,'created_at',3,'Created At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (393,45,'updated_at',4,'Updated At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (394,45,'deleted_at',5,'Deleted At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (395,45,'created_by',6,'Created By',NULL,'BIGINT',20,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,1,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (396,45,'updated_by',7,'Updated By',NULL,'BIGINT',20,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,1,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (397,45,'deleted_by',8,'Deleted By',NULL,'BIGINT',20,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,1,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (398,45,'pelajar_id',1,'pelajar_id',NULL,'VARCHAR',255,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,'pelajar','nama_penuh',NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (399,45,'test',2,'Test',NULL,'VARCHAR',255,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (400,46,'id',0,'ID',NULL,'INT',11,NULL,50,'left',NULL,1,1,0,0,'text_input',1,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,1,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (401,46,'created_at',3,'Created At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (402,46,'updated_at',4,'Updated At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (403,46,'deleted_at',5,'Deleted At',NULL,'DATETIME',NULL,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (404,46,'created_by',6,'Created By',NULL,'BIGINT',20,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,1,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (405,46,'updated_by',7,'Updated By',NULL,'BIGINT',20,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,1,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (406,46,'deleted_by',8,'Deleted By',NULL,'BIGINT',20,NULL,50,'left',NULL,1,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,1,1,0,0,0,1,0,1,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (407,46,'fakulti_id',1,'Fakulti ID',NULL,'VARCHAR',255,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,'fakulti','nama_fakulti',NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fields" VALUES (408,46,'jumlah_bayaran',2,'Jumlah Bayaran',NULL,'DECIMAL',255,NULL,50,'left',NULL,0,0,0,0,'text_input',0,0,0,0,1,0,0,0,0,50,'Normal','Regular','date_and_time','left',NULL,NULL,NULL,NULL,0,1,0,0,0,0,0,0,'link','detail_view','field_contents',NULL,0,'local',250,0,0,'square',50,50,0,0,'square',250,250,0,0,0,'local','images',1074,0,0,'download_link','clickable_icon',NULL,0,'url',50,50,360,0,50,50,480,360,NULL,NULL,NULL,NULL,'dropdown',0,'modal',NULL,'dropdown',NULL,'default',0,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0',1,1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,'Yes','No',0);
INSERT INTO "fixzy_settings" VALUES ('check_updates','1');
INSERT INTO "fixzy_settings" VALUES ('autosave_interval','15');
INSERT INTO "fixzy_settings" VALUES ('show_begin_box','1');
INSERT INTO "fixzy_settings" VALUES ('font_size','small');
INSERT INTO "fixzy_settings" VALUES ('doc_root','C:\Users\mohdh\Desktop\janaan');
INSERT INTO "fixzy_settings" VALUES ('base_url','http://localhost');
INSERT INTO "fixzy_settings" VALUES ('field_default_type','VARCHAR');
INSERT INTO "fixzy_settings" VALUES ('field_default_length','255');
INSERT INTO "fixzy_settings" VALUES ('table_suggest_icon','1');
INSERT INTO "fixzy_settings" VALUES ('table_allow_csv','1');
INSERT INTO "fixzy_settings" VALUES ('table_dv_separate_page','1');
INSERT INTO "fixzy_settings" VALUES ('table_hide_save_as_copy','0');
INSERT INTO "fixzy_settings" VALUES ('table_allow_add_from_homepage','0');
INSERT INTO "fixzy_settings" VALUES ('table_show_record_count','0');
INSERT INTO "fixzy_settings" VALUES ('project_encoding','3-Byte Unicode UTF-8');
INSERT INTO "fixzy_settings" VALUES ('project_rtl','0');
INSERT INTO "fixzy_settings" VALUES ('project_doxygen','1');
INSERT INTO "fixzy_settings" VALUES ('project_hide_footer','0');
INSERT INTO "fixzy_settings" VALUES ('max_entries','150');
INSERT INTO "fixzy_settings" VALUES ('project_no_trim','0');
INSERT INTO "fixzy_settings" VALUES ('lock_core_components','0');
INSERT INTO "menu_groups" VALUES (1,1,'Biodata',2);
INSERT INTO "menu_groups" VALUES (2,1,'Akademik',3);
INSERT INTO "menu_items" VALUES (1,1,NULL,1,NULL,'Users','users Module',1,0);
INSERT INTO "menu_items" VALUES (38,1,NULL,NULL,NULL,'FAQs','faq.php',4,0);
INSERT INTO "menu_items" VALUES (39,1,NULL,NULL,NULL,'About Us','aboutus.php',5,0);
INSERT INTO "menu_items" VALUES (54,1,1,38,NULL,'Pelajar','pelajar Module',0,0);
INSERT INTO "menu_items" VALUES (55,1,1,39,NULL,'Profil Pelajar','profil_pelajar Module',1,0);
INSERT INTO "menu_items" VALUES (56,1,1,40,NULL,'Dokumen Pelajar','dokumen_pelajar Module',2,0);
INSERT INTO "menu_items" VALUES (57,1,2,41,NULL,'Kursus','kursus Module',0,0);
INSERT INTO "menu_items" VALUES (58,1,2,42,NULL,'Pendaftaran Kursus','pendaftaran_kursus Module',1,0);
INSERT INTO "menu_items" VALUES (59,1,NULL,43,NULL,'Pengesahan Pendaftaran','pengesahan_pendaftaran Module',0,0);
INSERT INTO "menu_items" VALUES (61,1,2,NULL,3,'New Pendaftaran Baru','pendaftaran_kursus Custom Module',2,0);
INSERT INTO "menu_items" VALUES (62,1,NULL,44,NULL,'fakulti','fakulti Module',6,0);
INSERT INTO "menu_items" VALUES (69,1,NULL,NULL,14,'PelajarTest','pelajar Custom Module',7,0);
INSERT INTO "menu_items" VALUES (70,1,NULL,45,NULL,'keputusan_ujian','keputusan_ujian Module',8,0);
INSERT INTO "menu_items" VALUES (71,1,NULL,46,NULL,'invoice','invoice Module',9,0);
INSERT INTO "parent_child_relationships" VALUES (40,38,39,'pelajar_id','id','one-to-one',0,0,0,'Profil Pelajar',0,1,0,0,'CASCADE','CASCADE');
INSERT INTO "parent_child_relationships" VALUES (41,38,40,'pelajar_id','id','one-to-many',1,1,0,'Dokumen Pelajar',0,1,1,0,'CASCADE','CASCADE');
INSERT INTO "parent_child_relationships" VALUES (42,41,41,'prasyarat_kursus_id','id','one-to-many',1,1,0,'Kursus',0,1,0,0,'SET NULL','CASCADE');
INSERT INTO "parent_child_relationships" VALUES (43,38,42,'pelajar_id','id','one-to-many',1,1,0,'Pendaftaran Kursus LAMA',0,1,0,0,'CASCADE','CASCADE');
INSERT INTO "parent_child_relationships" VALUES (44,41,42,'kursus_id','id','one-to-many',1,1,0,'Pendaftaran Kursus',0,1,0,0,'CASCADE','CASCADE');
INSERT INTO "parent_child_relationships" VALUES (45,42,43,'pendaftaran_id','id','one-to-one',1,1,0,'Pengesahan Pendaftaran',0,1,0,0,'CASCADE','CASCADE');
INSERT INTO "parent_child_relationships" VALUES (47,1,43,'user_id','id','one-to-many',1,1,0,'Pengesahan Pendaftaran',0,1,0,0,'NO ACTION','NO ACTION');
INSERT INTO "parent_child_relationships" VALUES (48,44,38,'fakulti_id','id','one-to-many',1,1,0,'Pelajar',0,1,0,0,'NO ACTION','NO ACTION');
INSERT INTO "parent_child_relationships" VALUES (49,38,45,'pelajar_id','id','one-to-many',1,1,0,'Keputusan Ujian',0,1,0,0,'NO ACTION','NO ACTION');
INSERT INTO "parent_child_relationships" VALUES (50,44,46,'fakulti_id','id','one-to-many',1,1,0,'Invoice',0,1,0,0,'NO ACTION','NO ACTION');
INSERT INTO "projects" VALUES (1,'Sistem Urus Kursus','31 December 2026','11:59 PM','English','Asia/Kuala_Lumpur','bootstrap',0,0,1,'top',1,4,1,100,0,1,0,1,0,1,1,NULL,'{
  "blocks": {
    "block_1770304262478": {
      "type": "hook_trigger",
      "x": 132.6666259765625,
      "y": 69.33331298828125
    },
    "block_1770304280942": {
      "type": "insert_record",
      "x": 90,
      "y": 240,
      "configData": "[{\"type\":\"comment\",\"value\":\"\"}]"
    }
  },
  "connections": [
    {
      "fromBlock": "block_1770304262478",
      "fromPoint": "out",
      "toBlock": "block_1770304280942",
      "toPoint": "in"
    }
  ]
}','laravel_filament','sqlite','fixzySys','soft',1,0,0,0,0,1,1,1,'standard','',1);
INSERT INTO "table_constraints" VALUES (7,42,'pelajar_kursus_unique','UNIQUE','["pelajar_id","kursus_id"]');
INSERT INTO "tables" VALUES (1,1,'users',0,'Users','Users',NULL,1,1,'standard',NULL,0,1,1,1,1,0,0,1,1,'horizontal',0,0,NULL,NULL,'Detail View','',NULL,NULL,NULL,1,0,1,0,0,1,0,'dynamic',2,NULL,NULL);
INSERT INTO "tables" VALUES (38,1,'pelajar',0,'Pelajar','Pelajar Kursus','Maklumat tentang pelajar diuruskan disini.',0,1,'standard',NULL,0,1,1,1,0,1,1,1,1,'horizontal',0,0,NULL,NULL,'Detail View','current_user',NULL,NULL,NULL,1,0,1,0,0,1,0,'dynamic',2,NULL,NULL);
INSERT INTO "tables" VALUES (39,1,'profil_pelajar',1,'ProfilPelajar','Profil Pelajar',NULL,1,1,'standard',NULL,0,1,1,1,1,0,0,1,1,'horizontal',0,0,NULL,NULL,'Detail View','',NULL,NULL,NULL,1,0,1,0,0,1,0,'dynamic',2,NULL,NULL);
INSERT INTO "tables" VALUES (40,1,'dokumen_pelajar',2,'DokumenPelajar','Dokumen Pelajarx',NULL,1,1,'standard',NULL,0,1,1,1,1,0,0,1,1,'horizontal',0,0,NULL,NULL,'Detail View','',NULL,NULL,NULL,1,0,1,0,0,1,0,'dynamic',2,NULL,NULL);
INSERT INTO "tables" VALUES (41,1,'kursus',3,'Kursus','Kursus',NULL,1,1,'standard',NULL,0,1,1,1,1,0,0,1,1,'horizontal',0,0,NULL,NULL,'Detail View','',NULL,NULL,NULL,1,0,1,0,0,1,0,'dynamic',2,NULL,NULL);
INSERT INTO "tables" VALUES (42,1,'pendaftaran_kursus',4,'PendaftaranKursus','Pendaftaran Kursus',NULL,1,1,'standard',NULL,0,1,1,1,1,0,0,1,1,'horizontal',0,0,NULL,NULL,'Detail View','',NULL,NULL,NULL,1,0,1,0,0,1,0,'dynamic',2,NULL,NULL);
INSERT INTO "tables" VALUES (43,1,'pengesahan_pendaftaran',5,'PengesahanPendaftaran','Pengesahan Pendaftaran',NULL,1,1,'standard',NULL,0,1,1,1,1,0,0,1,1,'horizontal',0,0,NULL,NULL,'Detail View','',NULL,NULL,NULL,1,0,1,0,0,1,0,'dynamic',2,NULL,NULL);
INSERT INTO "tables" VALUES (44,1,'fakulti',6,'Fakulti','Pelajar Fakulti Ekonomi',NULL,1,1,'standard',NULL,0,1,1,1,1,0,0,1,1,'horizontal',0,0,NULL,NULL,'Detail View','',NULL,NULL,NULL,1,0,1,0,0,1,0,'dynamic',2,NULL,NULL);
INSERT INTO "tables" VALUES (45,1,'keputusan_ujian',7,'KeputusanUjian','table_khpmrn',NULL,1,1,'standard',NULL,0,1,1,1,1,0,0,1,1,'horizontal',0,0,NULL,NULL,'Detail View','',NULL,NULL,NULL,1,0,1,0,0,1,0,'dynamic',2,NULL,NULL);
INSERT INTO "tables" VALUES (46,1,'invoice',8,'Invoice','Invoice',NULL,1,1,'standard',NULL,0,1,1,1,1,0,0,1,1,'horizontal',0,0,NULL,NULL,'Detail View','',NULL,NULL,NULL,1,0,1,0,0,1,0,'dynamic',2,NULL,NULL);
COMMIT;
