# FiziSysMaker Platform Rebuild — Master Plan

> **For Hermes:** Execute this plan phase-by-phase, task-by-task. After EVERY completed task/phase, update this file: tick the checkbox, fill the "Result" note, and append to the Update Log at the bottom. This file is the single source of truth for program status. Never mark a task done without its verification step actually passing.
>
> **STANDING AUDIT RULE (owner directive 2026-09-21):** After every phase completes, run a dedicated audit pass before starting the next phase. The audit must: (1) re-run all test layers (golden, e2e smoke, audit_headless) and confirm green; (2) verify the phase's claimed outputs actually exist and match the plan (read back, don't trust); (3) hunt for runtime-only bugs the tests can't catch (boot the generated app, hit HTTP endpoints, check logs); (4) verify harness itself against sabotage (a deliberately broken golden/fixture must FAIL); (5) record findings + fixes in the Update Log. A phase is only "complete" when its audit passes.

**Goal:** Evolve FiziSysMaker from a Filament-only template replacer into a multi-stack, well-tested code-generation platform: neutral IR → pluggable stack generators, template-engine-based generation with a validation layer, native (zero-dependency) feature code, and desktop + headless-web delivery.

**Architecture:** The existing SQLite schema store becomes a formalized, Filament-neutral Intermediate Representation (IR). Generators become pure functions `(ir, options) => {relativePath: content}` rendered from Nunjucks templates. A post-generation validator layer (php -l + custom rules) gates every output. Delivery modes: Electron desktop (Win/mac) and `fizisysmaker serve` (localhost web UI, user-owned process, path-allowlisted writes).

**Tech Stack:** Electron 40, Node.js, better-sqlite3, Nunjucks (new), node-sql-parser, bundled PHP 8.4 (`bin/`), golden/snapshot test harness (extends `test/audit_headless.js`).

**Ground rules (apply to every phase):**
- Backup files with `.bak-YYYYMMDD` before large edits (owner convention).
- Keep the app runnable at the end of every task — never leave a broken intermediate committed.
- New code comments in English (public pass already planned); do not newly author Malay strings.
- Do NOT touch production; dev/local only.
- Filament core is NOT redeveloped. Only peripheral 3rd-party plugins are replaced with generated native code.
- No Filament vocabulary may leak into the IR (Phase 1 discipline).

**Definition of Done for the whole program:**
- [ ] IR formalized; generators consume IR only (no direct Filament-shaped DB reads in render logic)
- [ ] All templates on Nunjucks; zero `<<PLACEHOLDER>>` string-replace in generators
- [ ] Post-generation validator: `php -l` + no leaked `<<`/`{%` + unresolved-import check
- [ ] Golden test matrix ≥ 15 fixtures covering all feature axes, green in CI
- [ ] Auditing + tenancy generated natively; zero `Tapp\FilamentAuditing` (or similar) references in output
- [ ] `fizisysmaker serve` headless mode with path allowlist + zip export
- [ ] macOS Electron build runs (codesign deferred/documented)
- [ ] Public MVP gate (5-point, from AUDIT-2026-09-20) green; repo published

---

## Phase 0 — Safety net before touching anything

**Objective:** Lock current behavior with tests so every later refactor is provably non-regressive.

**STATUS: COMPLETE (2026-09-21, commit 27683137)**

- [x] **0.1** Run existing headless audit to confirm baseline green.
  - Run: `node test/audit_headless.js` (uses `test/debug_schema_output.json`)
  - Verify: 45 PHP files generated, all pass `php -l`. Record output in Update Log.
  - Result: PASS — 45 files, 6/6 generators OK (re-verified after refactor too).
- [x] **0.2** Create golden snapshot harness `test/golden.js`:
  - Takes a fixture schema JSON → runs generators → writes output tree to `test/golden/<fixture>/`.
  - `--update` flag regenerates goldens; default mode diffs against goldens and fails on any diff.
  - Result: DONE. Runs the FULL stack via extracted `generateLaravelFilamentStack`
    (not just 6 generators like audit_headless). Includes `php -l` gate per file.
    Timestamped migration filenames normalized to `TS__` prefix so comparison is
    stable across runs. Sabotage-tested: modified golden correctly FAILS with line diff.
  - Note: `bin/php-8.4.12` is Windows-only (php.exe); harness uses system `php`
    (8.5.4 here) with a warning fallback if absent.
- [x] **0.3** Extract the current fixture into `test/fixtures/base_simple.json` (plain CRUD, no tenancy/custom modules) and add it to the harness.
  - Result: DONE — users + fakulti tables, relationships=[], custom_modules=[],
    unified_menu filtered to kept tables. 19 files generated, all php -l pass,
    golden compare PASS across repeated runs.
  - IMPORTANT fixture-shape lesson: generators expect `relationships` as an ARRAY
    and `database.unified_menu` present (iterable). Fixtures must match the live
    dump shape, not object-keyed maps.
- [x] **0.4** Commit: `test: golden snapshot harness + base_simple fixture`.
  - Result: commit 27683137 (24 files). Also extracted
    `src/generators/laravelFilamentStack.js` (orchestrator moved out of main.js,
    main.js now requires it — verified `node --check` + audit_headless still green).
    main.js backup at src/main.js.bak-20260921.

### Phase 0 AUDIT (owner-requested, 2026-09-21) — PASSED after fixes

Audit found the golden harness alone was NOT sufficient — it only proves
byte-stability + `php -l`, not that generated code RUNS. Built
`test/e2e_smoke.js` (generate -> overlay on preview_env copy -> composer
dump-autoload -> clear filament cache -> migrate:fresh --seed -> boot ->
sqlite table check -> HTTP GET /admin/login == 200) and it immediately
caught 3 REAL runtime bugs invisible to php -l:

1. DeploymentGuide template: `?string $navigationIcon` must be
   `string|BackedEnum|null` in Filament 4 -> PHP Fatal on boot. FIXED.
2. Same file: `?string $navigationGroup` must be `string|UnitEnum|null`. FIXED.
3. Same file: `protected static string $view` -> parent declares
   non-static `protected string $view` -> redeclare fatal. FIXED.
(No other template had these patterns — grepped clean.)

Environment findings (matters for Phase 5/6):
- Bundled preview_env vendor classmap contains stale Windows absolute paths
  (D:\Projects\...) -> must `composer dump-autoload` on Linux.
- bootstrap/cache/filament discovery cache baked from previous preview runs
  references stale resource classes -> must be cleared when overlaying new code.
- e2e workdir kept at /tmp on failure for inspection; server auto-killed.

Audit verification: sabotage test (golden tampered -> harness FAILS with diff),
fixture-missing -> exit 1, full e2e HTTP 200, audit_headless 45 files 6/6.
Fix commit: 98cddf2d.

---

## Phase 1 — Formalize the neutral IR

**Objective:** Define `IR` as an explicit JSON schema (entities/fields/relations/permissions/menus/workflows) with NO Filament terms; make `getFullProjectSchema()` emit IR; generators read IR only.

**STATUS: COMPLETE (2026-09-21, commit a9218390)**

- [x] **1.1** Inventory: `resources/schema.sql` (12 tables, ~230 columns) read in full; every column classified in `docs/IR_MAPPING.md` — U (universal) / presentation (stack-ignorable bag) / I (app-internal, excluded). Vocabulary renames enforced at IR boundary (tenancy_type→ownership.model, show_count_in_tv→metrics.count_in_list, tv_*/dv_*→presentation, unified_menu→navigation).
- [x] **1.2** `docs/IR_SCHEMA.json` — JSON Schema draft-07, IR v1: meta / features (auth, authorization, auditing, seeders, soft_delete, ownership, tools, replication) / entities+fields (neutral `input_kind` enum) / relations (kind+integrity+metrics) / navigation (flat, group-referenced) / modules (saved views over entities) / widgets / workflows. Open `presentation` bags keep UI hints out of core semantics. Verified with own validator (ajv-cli not installed; validate.js covers types/enums/patterns/required/$ref).
- [x] **1.3** `src/ir/exporter.js` — fullSchema dump → IR: display_type→input_kind normalization, nested unified_menu flattening, tenancy→ownership, on_delete/on_update→integrity. Reserved lossless `_source` copy + `src/ir/adapter.js` (asLegacyFullSchema) = the migration shim; delete when Phase 2 converts all generators.
- [x] **1.4** `src/ir/validate.js` — dependency-free validator + CLI. Wired into generate-app (main.js): export+validate before generation, warn-only during migration (hard gate planned Phase 2).
- [x] **1.5** `test/fixtures/base_simple_ir.json` committed; `test/ir_test.js` proves fixture→IR→validate→adapter round-trip (byte-identical)→generate→matches Phase 0 golden. PASS.
- [x] **1.6** Committed as a9218390.

### Phase 1 AUDIT (2026-09-21) — PASSED

- All layers green: golden PASS, ir_test PASS, audit_headless 45 files 6/6, `node --check src/main.js` OK.
- Read-back of committed IR fixture: version/meta/entities/fields/nav correct; per-field input_kind verified.
- Vocabulary leak scan on IR core (excluding `_source`, legacy by design): only "filament" appears as the legitimate `target_stack` value; no maker terms (tenancy_type, record_owner, show_count_in_tv, unified_menu) leak into core.
- Sabotage tests: (a) broken adapter round-trip → ir_test FAILS as expected; (b) invalid enum injected into IR → validator catches with exact path (ir.features.ownership.model). Note: a first sabotage attempt used a VALID enum value and correctly passed — confirms strictness is real, not a false positive.
- Big fixture (10 tables / 10 relations / nested menu groups) exports valid IR; display_type distribution (87 text_input, 1 repeater_simple, 2 options_list) maps cleanly.
- Known gaps accepted for v1 (revisit Phase 2): repeater_* sub-fields remain presentation-bag (not structured sub-entities); field_validations rows not exercised (fixture dump lacks them — exporter supports the shape); widget advanced_query opaque.

**Risk:** Renaming concepts touches many generators. Mitigation: adapter layer (1.3) keeps old accessor names alive; migrate generators one at a time in Phase 2, deleting adapter shims as each generator converts.

---

## Phase 2 — Template engine migration (Nunjucks) + validator layer

**Objective:** Replace `<<PLACEHOLDER>>` + string-built conditionals with Nunjucks templates where logic lives IN the template; JS only supplies data. Add post-generation validator.

- [x] **2.1** `npm install nunjucks`. Create `src/render/engine.js`: configure Nunjucks (autoescape OFF — PHP output, `trimBlocks/lstripBlocks` on), register helpers (case converters from `src/utils.js`, `pluralize`), expose `renderTemplate(name, context) => string`.
- [x] **2.2** Create `src/render/validate.js` — post-generation validator run over every generated file:
  - `php -l` via bundled `bin/php-8.4.12` (reuse existing pattern from `test/audit_headless.js`)
  - No leftover `<<`, `{%`, `{{` sequences in output
  - Every `use X\Y;` referenced in body (heuristic: class short-name appears in content)
  - Namespace matches file path convention
  - Verify: unit-test the validator with deliberately broken strings; each rule fires.
- [x] **2.3** Migrate templates ONE generator at a time, easiest → hardest. For each: convert `.template` → `.md.tpl`/`.njk`, move JS-built conditional strings into `{% if %}` blocks, generator builds a plain context object, output diffed against golden (must be byte-identical or reviewed-identical), validator green, commit.
  - Order: Docs(52 LOC) → RelationManagers(98) → Exports(141) → Create(138) → Edit(206) → List(243) → Importers(295) → AdminPanel(139) → Resource(449) → Tables(564) → Schemas(785) → Database(858).
  - Commit per generator: `refactor(<gen>): migrate to nunjucks templates`.
- [x] **2.4** Delete the `<<PLACEHOLDER>>` machinery (`readTemplate` replace-chains) once all generators converted.
  - Verify: `grep -rn "<<[A-Z_]*>>" src/generators/` returns nothing.
- [x] **2.5** Re-run full golden matrix; update goldens only with explicit review of each diff.

**Note:** Whitespace differences during migration are expected. Rule: run `php -l` + validator on every diff; if semantics identical, accept and re-baseline goldens once at the end of 2.3 with a dedicated commit `test: rebase goldens after template engine migration (whitespace-only)`.

---

## Phase 3 — Bug hunt: feature-axis fixture matrix

**Objective:** Systematically cover the combination space that produced live bugs; every reproduced bug becomes a permanent fixture.

- [ ] **3.1** Enumerate feature axes from IR: tenancy (none/1:m/m:m), row ownership, custom modules (+overrides), relation types (hasMany/hasManyThrough/belongsTo/morph), field types (all supported), import/export/print, auditing, soft delete, computed/calculation queries, repeaters, indexes/constraints, multi-tenant menu scoping.
  - Deliverable: `docs/FEATURE_MATRIX.md` — axes × values, which fixtures cover which combos.
- [ ] **3.2** Create ~12 more fixtures (single-axis first): `tenancy_1m`, `tenancy_mm`, `row_owner`, `custom_module_basic`, `custom_module_override`, `relations_all`, `field_types_all`, `import_export_print`, `auditing_on`, `soft_delete`, `calc_queries`, `menus_complex`.
- [ ] **3.3** Add stress-combo fixtures (2–3): `combo_tenancy_custommodule_audit`, `combo_owner_relations_export`.
- [ ] **3.4** Run matrix; every failure = a bug ticket in `docs/BUGS.md` (reproduce command + fixture + expected vs actual). Fix each with TDD: failing golden → fix generator → green.
- [ ] **3.5** Ask owner to list past live bug scenarios from their real testing; encode each as a fixture. (Owner input required — do not skip.)
- [ ] **3.6** CI: GitHub Actions workflow `.github/workflows/ci.yml` — `npm ci && node test/golden.js` on push/PR.

**Exit criterion:** 15+ fixtures, 100% green, matrix doc shows every axis value covered.

---

## Phase 4 — Native feature code: kill the 3rd-party peripheral plugins

**Objective:** Generated apps depend on Filament core + first-party packages ONLY. Auditing, tenancy, and other peripheral features are generated as native app code, zero-config.

- [ ] **4.1** Inventory every 3rd-party plugin reference in templates/output (grep `Tapp\`, `composer.json` additions, provider registrations). Deliverable: table in `docs/NATIVE_FEATURES.md`: plugin → what it does → native replacement plan.
- [ ] **4.2** **Auditing native**: generate `audits` migration, `Audit` model, `AuditObserver` (boot in AppServiceProvider or via generated service provider), `AuditsRelationManager` — replacing `Tapp\FilamentAuditing`. Feature-flagged in IR (`features.auditing`).
  - TDD: fixture `auditing_on` golden includes native files and NO `Tapp\` string.
- [ ] **4.3** **Tenancy native**: formalize the existing scoping-property approach into generated traits (`BelongsToTenant` trait with global scope + creating hook) instead of relying on any package. Verify both 1:m and m:m fixtures.
- [ ] **4.4** Any remaining plugin (print, etc.): same pattern — native generated code or documented exception.
- [ ] **4.5** Generated `composer.json` audit: `composer require --dry-run` (bundled composer.phar) against a real Laravel skeleton to prove dependency resolution.
- [ ] **4.6** Full golden re-run + one real end-to-end: generate app into `resources/preview_env` clone, `composer install`, migrate, smoke-test in preview.

---

## Phase 5 — Headless + Web UI delivery mode

**Objective:** `fizisysmaker serve` runs the same GUI in a browser on localhost; same IR/generators; safe file writes.

- [ ] **5.1** Extract core engine from Electron: create `src/core/` (or verify current generators already free of `electron` imports — grep `require('electron')` in generators/utils; move any offenders).
- [ ] **5.2** CLI entry `bin/fizisysmaker.js` (add `"bin"` to package.json): commands `serve [--port 7788] [--host 127.0.0.1]`, `generate --project <name> --out <path>`, `fixtures` (run golden tests).
- [ ] **5.3** Express (or plain http) server serving the existing renderer as static web UI + IPC-over-HTTP shim mirroring the 54 IPC handler names (POST `/ipc/<channel>`). Reuse main.js handler logic by extracting handlers into `src/handlers/*.js` shared by Electron and web.
- [ ] **5.4** **Path allowlist (security-critical):**
  - Output roots from config: `FSM_OUTPUT_ROOTS` (default `~/projects`, `$HOME`).
  - Resolve `fs.realpathSync` on destination parent; reject if outside allowlist; reject symlink escapes; reject `..` traversal before resolution too.
  - TDD: unit tests for traversal, symlink escape, allowed path, missing parent.
- [ ] **5.5** Zip export mode: generate to temp → zip → serve download. (Solves remote/permission-free delivery.)
- [ ] **5.6** Bind to 127.0.0.1 by default; if `--host 0.0.0.0`, require explicit `FSM_ALLOW_REMOTE=1` + print big warning. No auth in v1 remote — documented as LAN-only or put behind reverse proxy.
- [ ] **5.7** Electron BrowserWindow can later load the same local server (documented, not required this phase).

---

## Phase 6 — macOS + packaging

- [ ] **6.1** Test Electron app on macOS (owner hardware or CI macos runner): `npm start`, generators, bundled binaries situation.
- [ ] **6.2** `bin/` binaries: platform-specific. Move to per-platform download/setup script (`npm run setup:binaries`) keyed by `process.platform`; keep git slim. Document in README.
- [ ] **6.3** electron-builder config for Win + mac targets (unsigned first). Codesign/notarize documented as optional (needs Apple Developer account — owner decision).
- [ ] **6.4** CI matrix: ubuntu + macos golden tests.

---

## Phase 7 — Public MVP gate (from AUDIT-2026-09-20, unchanged)

- [ ] **7.1** Delete/mark empty non-PHP template dirs (`src/templates/{dotnet,java,javascript,python,ruby}`) — scope honesty; list them in README roadmap instead.
- [ ] **7.2** English pass: all code comments + UI strings (mechanical; do last so new code is already English).
- [ ] **7.3** Full README: what/why, GIF/screenshot, generator matrix, quickstart (clone → npm i → npm start → generate < 15 min), security notes, roadmap (other stacks).
- [ ] **7.4** Golden test matrix in CI green (Phase 3.6).
- [ ] **7.5** Gate DevTools behind `FSM_DEVTOOLS=1`.
- [ ] **7.6** Secret scan of full git history (repo has been private with real usage — scan before publish; if dirty, orphan-commit fresh history per portfolio bar).
- [ ] **7.7** Owner final sign-off → make repo PUBLIC.

---

## Sequencing & dependencies

```
P0 (safety net) ──► P1 (IR) ──► P2 (Nunjucks+validator) ──► P3 (bug matrix) ──┐
                                                        P4 (native plugins) ──┼──► P7 (public gate)
                                                        P5 (headless/web) ────┤
                                                        P6 (mac/packaging) ───┘
```
P4/P5/P6 can interleave after P3, but P7 requires all. Recommended order: 0→1→2→3→4→5→6→7 (P5 may start after P2 if headless is urgent).

## Risks & open questions

1. **IR migration blast radius** — mitigated by adapter layer + goldens; if a concept can't be made stack-neutral cleanly, document exception rather than forcing it.
2. **Whitespace churn in P2** — accepted once, rebaselined deliberately.
3. **Owner memory of live bugs (3.5)** — plan stalls without it; schedule early.
4. **macOS codesign** needs Apple Developer account — owner decision, not blocking (unsigned + docs acceptable).
5. **Remote web mode security** — v1 LAN-only stance; revisit auth if remote access becomes a requirement.
6. **preview_env vendor in git (14MB)** — decide during P6.2 slimming: keep for offline preview or setup-script download.

## Update Log

> Append one entry per completed task/phase. Format: `YYYY-MM-DD HH:MM UTC — <task id> — <done/blocked> — <result note / evidence>`.

- 2026-09-21 05:16 UTC — PLAN — created. Baseline: repo clean at b4f599b1; audit report 2026-09-20 exists; no prior plans dir.
- 2026-09-21 05:35 UTC — P0 (0.1–0.4) — done — commit 27683137. Golden harness green (base_simple, 19 files, php -l 19/19, stable across runs, sabotage detected). Orchestrator extracted to src/generators/laravelFilamentStack.js; main.js requires it; audit_headless still 45 files 6/6. Next: Phase 1 (IR inventory + schema).
- 2026-09-21 05:50 UTC — P0-AUDIT — passed after fixes — commit 98cddf2d. Built test/e2e_smoke.js (real boot + HTTP 200 check). Found & fixed 3 Filament-4 type bugs in DeploymentGuide template (navigationIcon/navigationGroup/view) that php -l missed. Standing audit rule added to plan header (applies to every future phase). All layers green: golden PASS, e2e PASS (HTTP 200), audit_headless 45/6-6. Next: Phase 1.
- 2026-09-21 06:20 UTC — P1 (1.1–1.6) — done — commit a9218390. IR v1 schema + exporter + validator + adapter + ir_test all landed; base_simple IR fixture committed; big fixture exports valid IR.
- 2026-09-21 06:30 UTC — P1-AUDIT — passed — see Phase 1 AUDIT section. Sabotage tests confirm validator + round-trip strictness. Next: Phase 2 (Nunjucks + validator layer).
- 2026-09-21 08:57 UTC — P2 (2.1–2.5) — done — commits 5b0ee7a..a865b684 (10 commits). Nunjucks engine (src/render/engine.js, autoescape off, explicit tags), post-gen validator (src/render/validate.js, severity error/warn), ALL 12 generators migrated to .php.njk templates (docs, relationmanagers, exports, create, edit, list, importers, adminpanel, resource, schemas, tables, database models/users-migration). <<PLACEHOLDER>> machinery + readTemplate() deleted from utils. Per-field inline template extracted to src/generators/fieldContext.js + schemas/FormField.php.njk. Bug fixed during migration: Edit page copy-marker used string-replace so 2nd <<FIRST_STRING_FIELD>> stayed empty ($data['']) — golden rebaselined with note. Second fixture added: big_university (10 tables, custom modules, tenancy, iframe relations).
- 2026-09-21 09:00 UTC — P2-AUDIT — passed. (1) All layers green: golden base_simple PASS (19 files), golden big_university PASS (134 files), php -l all pass, validate 19/19 + 134/134 hard rules, ir_test PASS, render_validate 11/11, audit_headless 6/6. (2) E2E both fixtures boot: artisan OK, tables present, HTTP /admin/login 200. (3) Sabotage tests: template whitespace change -> golden FAIL; unknown template -> engine throws fail-fast; leftover {{ }} in output -> leftover-nunjucks error; <<LEFTOVER>> injected -> golden FAIL. (4) Fresh clone /tmp/fsm_fresh2: npm ci + golden both fixtures PASS (reproducible, CRLF-safe via .gitattributes text=auto). (5) Read-back verified .njk tails byte-match golden (User.php tenant_methods/relationship_functions semantics: legacy replace('','') leaves whitespace lines -> plain 1:1 conversion, no {% if %} trimming). Known: unused-import warnings (pre-existing legacy imports) tracked as warn, cleanup in Phase 3+. Next: Phase 3.
