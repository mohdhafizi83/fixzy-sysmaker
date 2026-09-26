# Fixzy SysMaker — Form Design & Layout Plan (Phase E)

Goal: professional, situation-aware form design. Supported form styles:
Default (current), Grouped, Multi-step (Wizard), Accordion, Inline/Compact,
Survey/Feedback, Order/Checkout, Modal, Conditional, Conversational.

Key principles:
- DEFAULT = exactly what exists today. Config absent => byte-identical output
  (golden fixtures must not change).
- All new behavior is config-driven, stack-neutral IR first, Filament v5 emits.
- Every phase lands with golden fixtures + audit before the next starts.

## Storage (SQLite, incremental ALTER in src/core/store.js)

tables:
- form_layout_config TEXT   -- JSON, see schema below

fields:
- label_display TEXT DEFAULT ''   -- '' (inherit) | above | inline | hidden_placeholder
- form_group TEXT DEFAULT ''      -- group key this field belongs to
- visible_if TEXT DEFAULT ''      -- JSON {field, op, value} conditional visibility
- required_if_state TEXT DEFAULT '' -- JSON {field, op, value} conditional required

### form_layout_config JSON schema
{
  "style": "default|grouped|wizard|accordion|inline|survey|checkout|modal",
  "columns": 1|2|3,                    // overrides static grid for the form
  "label_display": "above|inline|hidden_placeholder",  // table-level default
  "groups": [
    { "key": "your_info", "title": "Your Info",
      "description": "", "collapsible": false, "collapsed": false }
  ],
  "ungrouped_title": "Additional Info", // section for fields with no group
  "wizard": { "start_step": 1, "skippable": false }  // used when style=wizard
}

visible_if / required_if ops: equals | not_equals | in | filled | empty | checked | unchecked
(value: string | array of strings; field = other field_name in same form)

## Phases

### E1 — Data model + plumbing (no behavior change)
1. store.js: ALTER tables.form_layout_config, fields.label_display,
   fields.form_group, fields.visible_if, fields.required_if_state.
2. resources/schema.sql: add columns for fresh DBs.
3. handlers/register.js: add to tables + fields allowedColumns; server-side
   JSON validation (shape + op whitelist + group key ^[a-z0-9_]+$).
4. New src/generators/formLayoutConfig.js — parse/normalize/validate
   (parseFormLayoutConfig, parseFieldFormSettings, anyFormLayoutEnabled).
   Invalid JSON => fall back to default (never crash generation).
5. Unit test: test/form_layout_config_test.js.

### E2 — Generator core: groups + label modes + conditionals
In laravelSchemasGenerator.generateFormSchemaString:
1. Group fields by form_group; emit one Section per group (header title +
   description), ungrouped fields in trailing section (only if present).
   style=default + no groups => current single-Section output unchanged.
2. Label modes per field (via fieldContext):
   - inline  => ->inlineLabel()
   - hidden_placeholder => ->hiddenLabel() + ->placeholder(caption)
     (skip for Checkbox/Radio which keep their labels)
3. visible_if  => ->visible(fn (Get $get) => ...) closure per op.
4. required_if_state => ->requiredIf('<field>', '<value>') for equals;
   closure-based required() for other ops.
5. Golden: fixtures form_grouped / form_label_modes / form_conditional.
   Existing 51 fixtures must stay byte-identical.

### E3 — Style presets (wizard / accordion / inline / survey / checkout / modal)
Generator maps style => composition:
- wizard    => Wizard::make()->steps([Step::make(group.title)->schema(...)])
               per group (whole form = 1 step if no groups).
- accordion => every group Section ->collapsible() (+collapsed flag).
- inline    => all fields ->inlineLabel(), columns=1.
- survey    => columns=1, groups collapsible off, helper text emphasis.
- checkout  => 2 columns, groups: items + billing style sections.
- modal     => form rendered inside modal action (existing modal infra:
               Action->schema(...) pattern already used by lookup modal).
Golden fixtures per style (on + off).

### E4 — GUI designer (renderer)
Table Settings > Record Form > new "Form Layout" panel (formLayoutDesigner.js):
- Style preset dropdown, columns, table-level label default.
- Group editor: add/remove groups (title, description, collapsible),
  assign fields to groups (select per field or drag-free checkbox lists).
- Live preview hint text. Serialises to form_layout_config via SaveManager.
Field Settings > General: label display select; Form Behavior:
visible-if / required-if rule builder (field dropdown + op + value).

### E5 — Dependent dropdowns (Room Number -> available slots)
Field setting `depends_on` (JSON {field, filter_column}) on lookup Selects:
- generator emits ->getModifiedOptions(fn (Get $get) => ... filtered query)
  + ->helperText(fn $get => "X slots remaining") when a count column set.
- Server-side revalidation note: options filtered in UI only; keep FK valid.
Golden fixture form_dependent.

### E6 — Conversational form
Generated Livewire component (chat-style, one question at a time) reusing
the same form_layout_config groups/fields:
- app/Livewire/Fixzy/ConversationalForm<Table>.php + blade chat view.
- Mounts the resource form schema; walks fields in order, stores answers,
  final confirm step, then creates record via same model.
- Opt-in per table (form_layout_config.style = "conversational" or a
  separate flag) surfaced as a page/route in generated app.
Golden fixture form_conversational.

### E7 — Full audit
- npm rebuild better-sqlite3; full golden suite (all fixtures, no diffs
  outside new ones); audit_headless (php -l all outputs); e2e_smoke on a
  form-layout fixture (migrate + boot + HTTP).
- Manual: generate demo app with wizard + conditional + dependent dropdown,
  verify in preview.
- Update skill + docs (FORM_DESIGN_LAYOUT_PLAN status column).

## Status (2026-09-25)

| Phase | Status | Notes |
|-------|--------|-------|
| E1 data model + plumbing | DONE | store.js migration, schema.sql, register.js whitelist + server-side JSON validation, formLayoutConfig.js IR + 12 unit tests |
| E2 generator core | DONE | groups/sections, label modes (above/inline/hidden_placeholder), visible_if/required_if closures; fixtures form_grouped, form_conditional, form_label_modes |
| E3 style presets | DONE | wizard (Wizard/Step), accordion (collapsible sections), inline, survey (1-col), checkout (2-col), modal (CreateAction modal-iframe + slim create layout); fixtures per style |
| E4 GUI designer | DONE | Table Settings > Form Layout tab (style/columns/label/groups editor/wizard opts); Field Settings > Form Behavior tab (label, group, visible-if, required-if, dependent dropdown) |
| E5 dependent dropdowns | DONE | depends_on {field, filter_column, count_column} -> relationship modifyQueryUsing + remaining-count helperText; fixture form_dependent |
| E6 conversational form | DONE | Livewire chat engine (/chat/{slug}), compiled registry, per-step validation, visible_if honoured server-side; fixture form_conversational |
| E7 audit | DONE | golden 79/79 (incl. 11 new form fixtures); audit_headless 56/56 generators; e2e_smoke PASS form_modal + form_conversational; live browser verify: chat flow created record (AHMAD BIN ALI room=1 slot=1), invalid input rejected without advancing, modal form opens create form in iframe with slim layout |

New fixtures: form_grouped, form_conditional, form_label_modes, form_wizard,
form_accordion, form_inline, form_survey, form_checkout, form_dependent,
form_modal, form_conversational (11 new, all green).

## Risks / notes
- Wizard inside resource create/edit: verify Filament v5 saves across steps
  (state persists in Livewire; validation per step). If create/edit wizard
  misbehaves, wizard mode targets modal/public form first.
- hidden_placeholder on Select: placeholder = "Select ..." — keep caption
  discoverable via aria-label.
- Nunjucks gotchas: no ternary `?:`; Blade comments; escape single quotes
  in emitted PHP strings.
- Golden RACE: run solo only after full suite stopped.
