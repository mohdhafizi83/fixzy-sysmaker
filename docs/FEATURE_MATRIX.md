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

### I. Authentication modules (project-level flags)
| Value | Trigger | Generated output | Fixture |
|---|---|---|---|
| Google SSO | `project.module_auth_google_sso = 1` | GoogleController + routes + `google_id` migration + Auth Settings page + login button (Socialite) | auth_ldap_sso |
| LDAP / AD | `project.module_auth_ldap = 1` | LdapAuthenticator service + FixzyLogin (AD usernames) + Auth Settings page (ldaprecord) | auth_ldap_sso |
| Email 2FA | `project.module_auth_email_2fa = 1` | `HasEmailAuthentication` trait + `->multiFactorAuthentication()` (native Filament) | auth_2fa |
| Login captcha | `project.module_auth_email_captcha = 1` | FixzyLogin arithmetic human-check (native, no service) | auth_captcha |
| Combinations | any subset | one FixzyLogin page merges captcha + SSO button + LDAP per flags | auth_ldap_sso (SSO+LDAP) |

Credentials model: SSO/LDAP keys are entered by the admin on the in-app
**Auth Settings** page after deployment (stored in `fixzy_settings` table) —
never baked into generated code or git.

### J. Workflow hooks (project/table hook_workflow)
| Value | Trigger | Generated output | Fixture |
|---|---|---|---|
| workflow blocks | `project_hook_workflow` / `table_hook_workflow` JSON (blocks + connections) | Observers, listeners, scheduled commands via `laravelWorkflowGenerator` | workflow_hooks |

### K. Workflow v2 blocks (2026-09-22)
| Block | Compiles to | Status |
|---|---|---|
| send_email | `Mail::raw` + `##variable.x##` interpolation | ✅ generated |
| http_request | `Http::timeout(15)->withHeaders()->get/post/...` | ✅ generated |
| data_transformer | date format / upper-lower / validated math (no eval) | ✅ generated |
| for_each_loop | `foreach ((array) $list as $__wf_loopItem)` | ✅ generated |
| switch | `switch/case/default` from out-case-N points | ✅ generated |
| if/then/else_if/else | nested parenthesized ternary | ✅ generated |
| try_catch | Catch branch executes when connected | ✅ generated |
| on_startup | `runStartupWorkflow()` in provider boot | ✅ generated |
| send_telegram | `Http::post api.telegram.org/bot<token>/sendMessage`; token from `FixzySetting` at runtime | ✅ generated |
| advanced action | `ACTION_SCRIPT_GRAMMAR` script: insert/update/delete + parameterized raw SQL (DDL rejected) | ✅ generated |
| send_whatsapp / delay | removed from product (owner decision 2026-09-22) | 🗑 removed |
| telegram settings (generated app) | `TelegramSettings` page (`/admin/telegram-settings`) + connection test | ✅ generated |
| mail settings (generated app) | `MailSettings` page + `applyMailSettings()` boot override of .env | ✅ generated |

### L. Real-time notifications & chat (project-level flags, 2026-09-23)
| Value | Trigger | Generated output | Fixture |
|---|---|---|---|
| Real-time off | `project.module_realtime = 0` | nothing generated (default) | all non-realtime fixtures |
| Reverb backend | `module_realtime = 1`, `realtime_backend = "reverb"` | `RealtimeServiceProvider` (broadcast config + channel auth + Echo client) + `ChatMessage` model/migration + `ChatMessageCreated` event + Chat page + Real-time Settings page + `->databaseNotifications()` (native Filament) | realtime_on |
| Pusher backend | `module_realtime = 1`, `realtime_backend = "pusher"` | same as Reverb; composer `pusher/pusher-php-server` instead of `laravel/reverb` | (manual; golden covers reverb) |

Native-first design: notifications bell, broadcasting facade, private
channels and the `notifications` table are all NATIVE (Filament v5 /
Laravel 12). Third-party packages only for the WebSocket transport
(no native alternative): `laravel/reverb` (first-party Laravel) or
`pusher/pusher-php-server`. Frontend `pusher-js` + `laravel-echo` are
pinned CDN builds with SRI integrity — no npm build needed in the
generated app. Broadcast credentials are entered by the admin on the
**Real-time Settings** page (`fixzy_settings`), never baked into code.
Deploy auto-installs composer + npm packages from `fixzy-manifest.json`.

### M. Google Sheets two-way sync (project + per-table flags, 2026-09-23)
| Value | Trigger | Generated output | Fixture |
|---|---|---|---|
| Module off | `project.module_google_sheets = 0` | nothing generated (default) | all non-gsheets fixtures |
| Module on, no table opted in | `module_google_sheets = 1`, all `google_sync_enabled = 0` | warning only, no files | (manual) |
| Table synced | `module_google_sheets = 1` + `table.google_sync_enabled = 1` (custom table) | `config/fixzy_sheets.php` target map + `GoogleSheetsSyncService` + `PullGoogleSheetsJob` + `GoogleSheetsServiceProvider` (observers + schedule) + `GoogleSheetSync` model/mapping migration + per-table `sync_uuid`/`sheet_synced_at` migration + per-table Observer + `CreateGoogleSheet{Model}Action` on the listing + Google Sheets Settings page | google_sheets_on |
| Core table blocked | `google_sync_enabled = 1` on `users`/system/feature-generated table | rejected at save (server-side throw); generator also never collects it | (audit_headless sabotage) |

Scope (owner decisions): **add and update only** — rows deleted in the
sheet are ignored and re-pushed; deletions from the app DO remove the
sheet row. **Polling** every few minutes (runtime-configurable
`gsheets_poll_minutes`, default 5) via the Laravel scheduler — not
real-time. **Service account** auth: JSON key uploaded on the generated
Google Sheets Settings page, stored in `storage/app/private` (never in
code/git); new sheets auto-shared with the configured admin email.
Row identity = `sync_uuid` (column A); conflicts resolved
last-write-wins using `updated_at` vs `last_synced_at`; the
`$importing` flag prevents sheet→DB→sheet echo loops. Repeater/file
fields and primary keys are excluded from the sheet. Deploy installs
`google/apiclient` via `fixzy-manifest.json`.

### N. Data visualization (widgets, 2026-09-26)
| Value | Trigger | Fixture |
|---|---|---|
| stat card | `widget_type = "stats"` | reports_dashboard |
| bar / pie | `chart_bar` / `chart_pie` | reports_dashboard |
| doughnut / polar | `chart_doughnut` / `chart_polar` | reports_dashboard |
| line / area | `chart_line` / `chart_area` | reports_dashboard |
| combo (dual-axis) | `chart_combo` (value_field + series_field) | reports_dashboard |
| radar | `chart_radar` | reports_dashboard |
| scatter / bubble | `chart_scatter` (X/Y) / `chart_bubble` (+size) | reports_dashboard |
| latest table | `table_latest` | reports_dashboard |
| refresh: static | `refresh_mode = "static"` (default) | reports_dashboard |
| refresh: poll | `refresh_mode = "poll"` + `refresh_interval` | reports_dashboard |
| refresh: live | `refresh_mode = "live"` (auto-enables `module_realtime`; observer + DataChanged + live views) | reports_dashboard |
| kiosk mode | `project.kiosk_enabled = 1` (+rotate/page-size) | reports_dashboard |

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
