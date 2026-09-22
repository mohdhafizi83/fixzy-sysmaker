# IR Mapping — SQLite store → Neutral IR

Purpose: classify every column in `resources/schema.sql` (the app's SQLite store)
so the IR (docs/IR_SCHEMA.json) contains stack-neutral semantics, and
stack-specific/UI-only concerns are explicitly quarantined.

Classification key:
- **U** = Universal semantic concept (any stack generator must honor it)
- **S** = Stack-specific (currently Filament-shaped vocabulary/behavior; map at
  generator level, do NOT rename into IR core)
- **I** = App-internal / UI state of Fixzy SysMaker itself (not part of IR)

Design decision (pragmatic): presentation metadata (colors, thumbnails, grid
spans) is universal to the *maker* but not to every *stack*. The IR therefore
has two zones per entity/field:
1. `core` semantics — required to generate a correct app on any stack.
2. `presentation` hints — optional bag any stack may ignore. This keeps the IR
   honest without forcing a lossy rename of 100+ UI columns.

## projects → ir.meta + ir.features

| current column | IR location | class | note |
|---|---|---|---|
| project_id | meta.id | U | |
| app_title | meta.app_name | U | |
| date_format, time_format | meta.formats.date/time | U | |
| language_select, timezone_select | meta.locale / meta.timezone | U | |
| theme_select, use_3d_effects, rtl, compact, panel_height, tables_per_row, extra_wide | presentation.theme.* | U(presentation) | stack may ignore |
| menu_orientation, menu_at_homepage | presentation.navigation_layout | U(presentation) | |
| hide_login | features.auth.login_enabled (inverted) | U | |
| allow_sql_tool, allow_server_status, allow_table_view_sql | features.tools.* | U | |
| admins_group_access | features.authorization.admin_group | U | |
| copy_children_async | features.replication.copy_children_async | U | |
| allow_pwa_install | presentation.pwa | U(presentation) | |
| url | meta.base_url | U | |
| project_hook_workflow | workflows (top-level) | U | JSON workflow spec |
| stack_base | meta.target_stack | U | 'laravel_filament', etc. |
| stack_database | meta.database_engine | U | |
| stack_theme | presentation.theme.name | U(presentation) | |
| data_delete_type | features.soft_delete.mode | U | hard/soft |
| module_auth_email / _2fa / _captcha / ldap / google_sso | features.auth.* | U | |
| module_authorization | features.authorization | U | |
| module_log_audit | features.auditing | U | |
| module_fake_data | features.seeders | U | |
| debug_mode | I | I | app dev setting |
| tenancy_type | features.ownership.model | U | standard→none, one_to_many→tenant_single, many_to_many→tenant_multi |
| tenant_table | features.ownership.tenant_entity | U | |
| is_active | I | I | app session state |

## tables → ir.entities[]

| current column | IR location | class | note |
|---|---|---|---|
| table_id | entities[].id | U | |
| table_name | entities[].name | U | |
| module_name | entities[].display_name_override | U | |
| table_order | presentation.order | U(presentation) | |
| table_view_title, table_description, detail_view_title | entities[].titles.* | U | |
| show_quick_search | entities[].capabilities.search | U | |
| allow_pagination, pagination_type | entities[].capabilities.pagination | U | |
| default_sort_by, sort_descending | entities[].default_sort | U | |
| allow_csv_export / allow_csv_import | entities[].capabilities.import_export | U | |
| allow_print_view, dv_allow_print_view | entities[].capabilities.print | U | |
| allow_mass_delete | entities[].capabilities.bulk_delete | U | |
| show_edit_button / show_delete_button | presentation.row_actions | U(presentation) | |
| allow_restore_delete / allow_force_delete | features.soft_delete.* | U | |
| tv_template, column_grid_type, static_grid_columns | presentation.layout.* | U(presentation) | |
| hide_field_captions, use_first_field_as_title | presentation.list_display.* | U(presentation) | |
| table_view_classes_input, detail_view_classes_input | presentation.css_classes | U(presentation) | |
| record_owner, owner_fk_value | features.ownership.row_owner | U | current_user → row_owner:user |
| default_focus, redirect_after_insert | presentation.form_flow.* | U(presentation) | |
| enable_detail_view | entities[].capabilities.detail_view | U | |
| delete_with_children | entities[].cascade.delete_children | U | |
| dv_separate_page, dv_hide_save_as_copy, dv_sticky_buttons, dv_allow_add_from_homepage | presentation.detail_view.* | U(presentation) | |
| table_hook_workflow | workflows per-entity | U | |
| feature_source | I | I | maker bookkeeping |

## fields → ir.entities[].fields[]

Core (U): field_name, caption, description, data_type, length, precision,
default_value, required, primary_key, auto_increment, unique, not_null,
unsigned, binary, is_indexed, read_only, min/max_length, min/max_value,
helper_text, placeholder.

Semantics (U): display_type (normalized to neutral input kinds),
options_list_values, options_display, boolean_label_true/false,
format_as, format_mask, prefix/suffix, calculated_enable + calculated_query,
algorithm_enable + algorithm_logic, calculation_builder_state,
lookup_parent_table/caption_1/caption_2/separator, accept_video_url,
allow_image_uploads + allow_file_uploads (+ storage provider, max size,
rename/delete flags), field_validations rows.

Presentation (U-presentation): alignment, tv_* (wrap, toggle, tooltips,
text_limit, size, weight, date format, colors, icons, thumbs, zoom),
dv_* thumbs, zero_fill, show_sum/avg/count/range_summary, allow_sorting,
media_* link settings, file_behavior/display_as, gmap_*, youtube_*,
column_span_full, off_autocomplete, repeater_* display/format/values/required.

Stack-specific (S): none in the column names themselves — display_type values
like 'options_list' are maker vocabulary; the IR normalizes them to a neutral
input-kind enum (text, textarea, select, multiselect, checkbox, date, file,
image, repeater, calculated, lookup, ...). Mapping table lives in
src/ir/normalizer.js (Phase 1.3).

## parent_child_relationships → ir.relations[]

| current column | IR location | class |
|---|---|---|
| relationship_id | relations[].id | U |
| parent_table_id / child_table_id | relations[].parent / .child (by name) | U |
| fk_child_field / parent_field | relations[].fk / .owner_key | U |
| relationship_type | relations[].kind (one-to-one/one-to-many/many-to-many) | U |
| on_delete / on_update | relations[].integrity | U |
| show_tab, show_icon, tab_title | presentation.relation_tab.* | U(presentation) |
| autoclose_modal, show_link_above, allow_add_from_tv | presentation.relation_ui.* | U(presentation) |
| copy_records | features.replication.copy_related | U |
| show_count_in_tv | metrics.related_count_in_list | U |

## menu_groups + menu_items → ir.navigation[]

Direct mapping: groups (name, order) + items (label, detail, order,
target: table|module|custom url, show_record_count). Neutral. Class U
(presentation.order for ordering).

## custom_modules + custom_module_fields → ir.modules[]

A module = a saved *view* over one entity: filter_rules (query spec),
included_relations, settings_override (entity-level), field selection with
per-field settings_override + display_order. Neutral concept (like a Rails
scope+form preset). Class U.

## table_constraints → ir.entities[].constraints[]

name, type (UNIQUE/PRIMARY KEY), columns (JSON array). Class U.

## field_validations → ir.entities[].fields[].validations[]

rule_type + params + is_active. Class U (maps to Laravel validator rules or
equivalents elsewhere).

## project_widgets → ir.widgets[]

Dashboard widgets: type, target table/field, aggregate, filters, timeframe,
advanced_query, span/icon/color. Class U (widgets) + presentation for
span/color/icon.

## fixzy_settings → NOT in IR

App-level maker settings (autosave, font size, doc_root...). Class I.
Exception: field_default_type/length feed the maker, not generated code.

---

## Vocabulary renames enforced at IR boundary

| maker/Filament term | IR neutral term |
|---|---|
| tenancy_type one_to_many | ownership.model = tenant_single |
| tenancy_type many_to_many | ownership.model = tenant_multi |
| record_owner current_user | ownership.row_owner = authenticated_user |
| show_count_in_tv | metrics.related_count_in_list |
| tv_* | presentation.list.* |
| dv_* | presentation.detail.* |
| unified_menu | navigation |
| custom_module | module (saved view over entity) |
| feature_source | (dropped — internal) |

Rule for Phase 2+: generators receive ONLY the IR object. Any Filament term
found inside IR export = bug; add to normalizer + test.
