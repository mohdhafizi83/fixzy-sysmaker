# Starter Pack Manifest Schema (v1)

A Starter Pack is a **pre-composed template** (tables, relations, layouts,
workflows) that jump-starts a project. It is **NOT a complete, ready-to-run
business system** — everything it installs is ordinary designer content that
can be edited, removed, or extended afterwards.

Packs live in this directory as `<slug>.json`. The installer
(`src/core/presetInstaller.js`) validates each manifest
(`src/core/presetSchema.js`) and applies it to the active project in one
transaction. Installed content is identical to hand-created content:
tables get the standard system fields, menu items, relationships, and
custom modules exactly as the designer UI would create them.

## Top-level fields

| field | required | notes |
|---|---|---|
| `schema_version` | yes | must be `1` |
| `slug` | yes | kebab-case, unique, matches filename |
| `name` | yes | display name |
| `tagline` | yes | one-line description for the picker |
| `category` | yes | `hr`, `operations`, `sales`, `support`, `scheduling`, ... |
| `caveats` | no | array of strings; shown highlighted in the preview modal. REQUIRED for anything touching money or time-critical logic ("tracking only — no financial calculations") |
| `tables` | yes | non-empty array, see below |
| `relationships` | no | parent/child links between declared table refs |
| `custom_modules` | no | filtered/overridden views on declared tables |
| `menu.groups` | no | explicit group names (auto-created anyway when referenced) |

## Tables

```json
{
  "ref": "leave_requests",
  "table_name": "leave_requests",
  "module_name": "Leave Requests",
  "menu_group": "Leave",
  "fields": [ ... ],
  "table_settings": { ... }
}
```

- `ref` — internal snake_case handle used by relationships/modules.
- `table_name` — snake_case, collision-checked against the project.
- System fields (`id`, `created_at`, `updated_at`, `deleted_at`,
  `created_by`, `updated_by`, `deleted_by`) are added automatically —
  declaring them is a validation error.
- `menu_group` — optional; omit for a top-level menu item.

### Fields

```json
{ "field_name": "start_date", "field_type": "DATE", "required": 1,
  "caption": "Start Date", "display_type": "datetime_input" }
```

- `field_type` ∈ VARCHAR, TEXT, LONGTEXT, INT, BIGINT, DECIMAL, BOOLEAN,
  DATE, DATETIME, TIMESTAMP, JSON, UUID (mirrors the designer's type list).
- `display_type` ∈ text_input, datetime_input, text_area, rich_html,
  check_box, options_list, repeater, repeater_simple.
  `options_list` REQUIRES `options_list_values` (`a|b|c`).
- Any other key must be a known field setting (see
  `src/presets/fieldTypes.js` — typo guard).

### Table settings

Keys mirror the designer's table settings whitelist. Common ones:
`table_view_title`, `approval_enabled` + `approval_config`,
`numbering_enabled` + `numbering_config`, `grid_calendar_enabled` +
`grid_calendar_config`, `grid_kanban_enabled` + `grid_kanban_config`,
`attachments_enabled`, `form_layout_config`.

`approval_config` shape (same as approvalManager.js serialises):

```json
{
  "statusField": "status",
  "initial": "pending",
  "statuses": [ { "key": "pending", "label": "Pending", "color": "warning", "final": false } ],
  "transitions": [ { "from": "pending", "to": "approved", "label": "Approve",
                     "roles": "", "require_comment": false, "notify": "submitter" } ]
}
```

`statusField` must be one of the table's declared fields. Colors:
gray, info, warning, success, danger.

## Relationships

```json
{ "parent_ref": "leave_types", "child_ref": "leave_requests",
  "fk_field": "leave_type_id", "parent_field": "id" }
```

`fk_field` must be declared in the child table's fields. `parent_field`
defaults to `id`.

## Custom modules

```json
{
  "ref": "my_leaves",
  "base_table_ref": "leave_requests",
  "module_name": "My Leave Requests",
  "menu_icon": "fa-solid fa-calendar-check",
  "menu_group": "Leave",
  "filter_rules": { "condition": "AND", "rules": [] },
  "included_relations": [],
  "settings_override": { "table_view_title": "My Leaves" },
  "fields": [ { "field_name": "status", "is_readonly": 1,
                "settings_override": { "caption": "State" } } ]
}
```

**Feature-flag rule (critical):** a module opting into calendar/kanban/tree
must carry BOTH the enabled flag and its config in its OWN
`settings_override` — flags are never inherited from the base table, or
every module duplicates the base module's page.

## Not included (v1)

- **Seed rows.** The store has no per-table seed storage; use the Fake
  Data module for demo records. (Decision logged 2026-09-26.)
- **Accounting / payroll / invoicing packs.** Double-entry, tax, and
  balancing logic is out of scope for a generator, forever.

## Authoring checklist

1. `node -e "const {validateManifest}=require('./src/core/presetSchema'); const r=validateManifest(require('./src/presets/<slug>.json')); console.log(r.valid ? 'OK' : r.errors)"`
2. Add a golden fixture via `test/make_preset_fixture.js` and run golden.
3. Every money/time-critical pack needs a `caveats` entry.
4. Keep table names generic-but-namespaced to minimise collisions.
