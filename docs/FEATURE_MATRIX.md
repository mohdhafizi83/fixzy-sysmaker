# Fixzy SysMaker Feature Matrix (Phase 3)

Axes × values from the schema/IR, and which fixture covers each combination.
Fixtures live in `test/fixtures/<name>.json` (live full-schema dump shape);
goldens in `test/golden/<name>/`.

Run all: `node test/golden.js`
Run one: `node test/golden.js <fixture>`

## Axes

### A. Tenancy / ownership (project-level + table-level)
| Value | Schema trigger | Fixture |
|---|---|---|
| none (standard) | `project.tenancy_type = "standard"` | base_simple, big_university, all single-axis below unless noted |
| one-to-many | `project.tenancy_type = "one_to_many"`, `tenant_table` set | tenancy_1m |
| many-to-many | `project.tenancy_type = "many_to_many"`, `tenant_table` set (pivot `<tenant>_user`) | tenancy_mm |
| row owner (current_user) | `table.record_owner = "current_user"` + `created_by`/`updated_by` fields | row_owner |

### B. Relationship types (database.relationships[])
| Value | `relationship_type` | Fixture |
|---|---|---|
| one-to-one | `one-to-one` (unique FK, no RelationManager) | relations_all, big_university |
| one-to-many | `one-to-many` (RelationManager generated) | relations_all, big_university |
| self-referencing | parent == child table | relations_all |
| integrity variants | `on_delete`/`on_update`: CASCADE / SET NULL / RESTRICT / NO ACTION | relations_all |

### C. Field types (display_type × data_type × format_as)
| Value | Trigger | Fixture |
|---|---|---|
| text_input (plain/email/password/tel/url/mask) | `display_type=text_input`, `format_as=*` | field_types_all |
| text_input numeric | `data_type=INT/BIGINT/DECIMAL`, min/max value | field_types_all |
| text_area / rich_html | `display_type=text_area|rich_html`, column_span_full | field_types_all |
| check_box | `display_type=check_box`, BOOLEAN | field_types_all |
| options_list single/multi | `display_type=options_list`, `options_display=single|multi` | field_types_all |
| datetime_input | `display_type=datetime_input`, DATETIME | field_types_all |
| repeater_simple | `display_type=repeater_simple` (JSON) | field_types_all, big_university |
| repeater (3 sub-fields) | `display_type=repeater`, `repeater_{1..3}_*` | field_types_all |
| lookup FK dropdown | `lookup_parent_table` + `lookup_display_as=dropdown` | field_types_all, big_university |
| unique / zero_fill / readonly / required | field flags | field_types_all |
| calculated (calculated_enable/query) | NOT supported by generators — gap logged | calc_queries (documents gap) |

### D. Table features (import / export / print / delete)
| Value | Trigger | Fixture |
|---|---|---|
| CSV export | `allow_csv_export=1` → Export class | import_export_print |
| CSV import | `allow_csv_import=1` → Importer class | import_export_print |
| print view | `allow_print_view=1`, `dv_allow_print_view=1` | import_export_print |
| mass delete / restore / force delete | `allow_mass_delete`, `allow_restore_delete`, `allow_force_delete` | import_export_print |

### E. Auditing / soft delete (project-level)
| Value | Trigger | Fixture |
|---|---|---|
| auditing on | `project.module_log_audit = 1` | auditing_on |
| soft delete | `project.data_delete_type = "soft"` (+ `deleted_by` column) | soft_delete |
| hard delete | `project.data_delete_type = "hard"` | row_owner (hard) |

### F. Custom modules
| Value | Trigger | Fixture |
|---|---|---|
| basic (filter rules) | `table.custom_modules[]` with `filter_rules` | custom_module_basic |
| overrides | `settings_override` (table + per-field) | custom_module_override |

### G. Navigation / menu scoping
| Value | Trigger | Fixture |
|---|---|---|
| flat items | `unified_menu` type=table_item | base_simple |
| nested groups | type=group with nested items | menus_complex |
| custom_item (static page link) | type=custom_item | menus_complex |
| custom_view_item (module link) | type=custom_view_item | menus_complex |
| show_record_count | `show_record_count=1` | menus_complex |

### H. Authorization / fake data
| Value | Trigger | Fixture |
|---|---|---|
| authorization on | `project.module_authorization = 1` | all fixtures (default on) |
| fake data / factories | `project.module_fake_data = 1` | all fixtures (default on) |

## Stress combos (2–3 axes at once)
| Fixture | Combo |
|---|---|
| combo_tenancy_custommodule_audit | one_to_many tenancy + custom module + auditing + soft delete |
| combo_owner_relations_export | row_owner + multi relations + csv import/export/print + hard delete |

## Coverage summary
- Every axis value above is covered by at least one fixture except:
  - `calculated_enable` — generator gap (see docs/BUGS.md BUG-001)
  - morph relations — not representable in current schema dump shape (no
    `relationship_type` for morph); out of scope until IR v2 adds it.
