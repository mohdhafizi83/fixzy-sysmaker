# Fixzy SysMaker Bug Log (Phase 3)

Format: ID — severity — axis — reproduce — expected vs actual — status.

Reproduce any: `node test/golden.js <fixture>` (compare vs golden),
or regenerate: `node test/golden.js <fixture> --update`.

---

## BUG-001 — calculated fields generate as plain TextInput (feature gap)
- Severity: Medium (silent feature loss)
- Axis: field types — `calculated_enable=1` / `calculated_query` / `algorithm_*`
- Fixture: `calc_queries` (table `jana_bil`, field `jumlah`)
- Reproduce: `node test/golden.js calc_queries` then inspect
  `app/Filament/Resources/JanaBils/Schemas/JanaBilForm.php`
- Expected: field rendered read-only with computed value (or documented
  unsupported so the maker UI can block it).
- Actual: generator ignores `calculated_enable`/`calculated_query` entirely —
  `jumlah` becomes a plain editable `TextInput::make('jumlah')->integer()`.
  No computed logic anywhere in output.
- Note: field keys exist in the schema dump but no generator module consumes
  them (grep `calculated` in src/generators = 0 hits). This is a pre-existing
  gap, not a Phase 2 regression.
- Status: OPEN — needs product decision (generate computed accessor + disabled
  input, vs explicitly out of scope). Do NOT silently re-baseline.

## BUG-002 — zero_fill flag ignored in table + form
- Severity: Low
- Axis: field types — `zero_fill=1`
- Fixture: `field_types_all` (field `kod_zero`, INT length 6)
- Expected: display padded (e.g. `str_pad` format) or documented as ignored.
- Actual: plain `TextColumn`/`TextInput`, no zero-padding logic.
- Status: OPEN (low priority; cosmetic)

## NON-BUG — options_display 'single' is not a valid value
- During fixture authoring, `options_display='single'` produced a TextInput
  with `->options()` (invalid combo). Live dumps only ever use
  `dropdown|multi|radios|checkboxes` (confirmed in big_university + app JS).
  'single' was my invention; fixture corrected to 'dropdown'. The generator's
  fallthrough for unknown options_display values is worth a warn-level rule
  later (tracked as improvement, not a bug).

## BUG-003 — many-to-many relation emits FK to a column that doesn't exist (FIXED)
- Severity: HIGH (migrate:fresh crashes — generated app unusable)
- Axis: relationship types — `relationship_type = "many-to-many"`
- Fixture: `tenancy_mm` (organisasi ↔ produk via pivot `organisasi_user`)
- Reproduce (before fix): `node test/e2e_smoke.js tenancy_mm` →
  `SQLSTATE[HY000]: unknown column "organisasi_id" in foreign key definition`
- Cause: `generateLaravelMigrations` FK pass emitted
  `$table->foreign(['organisasi_id'])` for every child relation regardless of
  type; m:m relations have no direct FK column (pivot-backed).
- Fix: FK pass now skips `relationship_type === 'many-to-many'`
  (src/generators/laravelDatabaseGenerator.js). Golden rebaselined for
  tenancy_mm (bogus `add_foreign_keys_to_produk` migration removed).
- Verified: e2e_smoke tenancy_mm PASS (migrate + boot + HTTP 200).
- Status: FIXED (this commit)

## Fixed during fixture bring-up
- (2026-09-21) golden harness auto-discovery picked up `base_simple_ir.json`
  (IR-format, not full-schema dump) and crashed. Fixed: harness skips
  `*_ir.json` (owned by test/ir_test.js). commit: see Phase 3 commit.

## S1 UI Sweep (2026-09-22, web mode)

### BUG-004: Web mode 404 for shared assets (fontawesome, theme preview images)
- Symptom: `/assets/fontawesome/css/all.min.css` and `/assets/images/*` 404 in
  `fixzy serve` — icons missing, theme preview broken. index.html references
  `../assets/` which resolves fine in Electron but not under the web server's
  srcDir-only static root.
- Fix: webServer.js now serves `/assets/*` from repo root (containment check
  per-base-dir; traversal probes `/assets/../../etc/passwd` rejected 404).
- Status: FIXED (this commit)

### BUG-005: No favicon.ico in repo
- Symptom: browser requests /favicon.ico -> 404 on every load (cosmetic).
- Fix: owner to provide icon; add to repo root + serve in webServer static.
- Status: OPEN (cosmetic, needs owner asset)

### BUG-006: "Configuration" banner button has no visible label target
- Observed: button labelled "Configuration" present in banner; during S1 pass
  no configuration panel/modal was identified by that name (Setup wizard covers
  env config). Needs S2 confirmation whether handler is wired.
- Status: OPEN (verify in S2)

### QA note: welcome modal reappears on reload
- The "Welcome to Your New Project" tutorial modal shows on every fresh page
  load while project is empty — by design? Annoying for repeat visits; consider
  persisting dismissed state. Not a bug per se; UX decision for owner.

## S2 Buttons/Forms Pass (2026-09-22)

### BUG-007: Show Preview broken in dev (web mode) - wrong resource paths
- Symptom: preview:instant-run -> "Template not found: src/resources/preview_env".
- Cause: register.js used __dirname/../resources/preview_env but handlers live
  in src/handlers/ so correct path is ../../resources/preview_env (repo root).
  Same bug for ../bin (should be ../../bin).
- Fix: both paths corrected.
- Status: FIXED (this commit)

### BUG-008: Preview port hardcoded 8080 - collides with other local services
- Symptom: another service (server-dashboard python) held :8080; artisan serve
  failed silently, promise never resolved -> UI stuck on loading overlay forever.
- Fix: findFreePort() helper (net.createServer probe, 8080..8099); preview:start
  and preview:instant-run both use dynamic port; port tracked in previewServerPort
  and reused while server alive.
- Status: FIXED (this commit)

### BUG-009: Stale previewServerProcess after crash -> false "Preview Ready"
- Symptom: after the PHP child died, Scenario 1 still reported success pointing at
  a dead port (HTTP connection refused).
- Fix: liveness probe (kill(pid,0)) in Scenario 1; exit handler clears
  previewServerProcess/Port so next call re-spawns.
- Status: FIXED (this commit)

### BUG-010: "View files" button has NO handler
- Symptom: #app-view_files button exists in index.html but no JS listens to it
  (grep across src/**/*.js: zero references). Click does nothing.
- Fix: TBD - should open the generated app folder (reuse generate-app result
  folderPath / staging path) or show a dialog with the path.
- Status: OPEN

### BUG-011: preview_env copy drift -> missing files (Concerns/HasAudits.php)
- Symptom: ~/.fixzy/preview_env copy from earlier session missed app/Models/
  Concerns/HasAudits.php (present in repo template) -> boot fatal "Trait not
  found"; also stale generated Resources (DokumenPelajarResource) referenced
  after cleanup -> Class not found; cache table missing broke optimize:clear.
- Root cause: first-time copy happened before template had those files / partial
  state; no integrity check on the working copy.
- Mitigation now: wiped ~/.fixzy/preview_env + schema cache, re-provisioning.
- Fix proposal: on instant-run, verify a manifest of key template files in the
  working copy; if mismatch, re-copy (or run composer dump-autoload + migrate).
- Status: OPEN (needs integrity-check design; workaround = wipe and reprovision)

### BUG-012: instant-run Scenario 3 missing audit files + stale classmap/panel cache
- Chain of failures found while verifying Show Preview end-to-end:
  1. Smart Folder Cleanup wipes app/Models/* (kecuali User.php) termasuk
     Audit.php + Concerns/HasAudits.php, tapi instant-run tak panggil
     generateNativeAuditFiles -> boot fatal "Trait HasAudits not found"
     (template User.php uses the trait when module_log_audit=1).
  2. Template vendor/composer classmap still maps deleted classes (old
     Resources/Policies from template-build time) -> Filament discovery
     fatals "Class ...Resource not found".
  3. Bundled bootstrap/cache/filament/panels/admin.php references old
     resources; artisan optimize:clear ABORTS at its DB cache-store flush
     on a fresh unmigrated env, leaving the panel cache stale.
- Fixes (register.js, instant-run Scenario 3):
  - call generateNativeAuditFiles after user model/migrations/seeder
  - composer dump-autoload after generation (uses bundled composer.phar)
  - fs.rmSync bootstrap/cache/filament (direct; can't rely on optimize:clear pre-migration)
- Verified: fresh wipe -> instant-run -> /admin/login HTTP 200 ->
  login admin@admin.com OK -> dashboard renders (screenshot 16).
- Status: FIXED (this commit)

## S4 Fixture Matrix (2026-09-22)

- Added test/overnight_batch.sh: runs e2e_smoke for every fixture, writes
  test/overnight_report_TS.md + per-fixture logs.
- New fixtures: auth_2fa, auth_captcha, auth_ldap_sso, debug_on
  (base_simple variants toggling previously-uncovered project flags).
- Batch result: 20/20 PASS (~7-8s each).
- BUG-014 (e2e harness): every PASS kept a ~134MB /tmp workdir; 20-fixture
  batch overflowed tmpfs (error -122 ENOSPC) mid-run. Fixed: e2e_smoke.js
  now removes workdir on PASS (keep only on FAIL; E2E_KEEP_WORKDIR=1 overrides).
- FEATURE GAP (documented, not a bug): generator consumes only
  module_log_audit, module_authorization, tenancy_type/tenant_table,
  app_title, menu_orientation. Flags module_auth_email_2fa,
  module_auth_email_captcha, module_auth_ldap, module_auth_google_sso,
  debug_mode are stored in DB but NO generator reads them -> generated app
  has no 2FA/captcha/LDAP/SSO/debug behavior. Same class as
  project_hook_workflow (workflow builder UI exists, generator emits nothing).

### BUG-010 FIXED (2026-09-22): "View files" now wired
- New IPC `generated:open-latest`: finds newest dir under userData/generated,
  opens via ctx.shell.openPath when available, always returns folderPath.
- Exposed as electronAPI.openLatestGenerated (preload + web-shim).
- renderer.js wires #app-view_files -> dialog showing latest generated path
  (and opens it in desktop mode). Verified live: dialog shows
  /home/fizi/.fixzy/generated/QA_Sweep_Test_staging.

### BUG-005 FIXED (2026-09-22): favicon added
- Generated assets/favicon.ico (7 sizes 16-256px, FZ mark, slate+amber theme)
  + favicon.png (256px). Linked in src/index.html <link rel="icon"> and
  Electron BrowserWindow icon in src/main.js. Verified HTTP 200 via webServer.

### BUG-015 FIXED v1 (2026-09-22): auth flags + workflow hooks now generate code
- module_auth_email_2fa -> User implements Filament 4 native
  HasEmailAuthentication + panel ->multiFactorAuthentication(EmailAuthentication::make()).
- module_auth_email_captcha -> generated App\Filament\Auth\CaptchaLogin
  (native session arithmetic challenge, no third-party) wired via ->login().
- project_hook_workflow / table_hook_workflow -> compiled by new
  src/generators/laravelWorkflowGenerator.js into Observers (table CRUD
  events), ProjectWorkflowListener (auth/eloquent events),
  ScheduledWorkflowCommand + WorkflowServiceProvider (auto-registered).
  v1 vocabulary: insert/update/delete_record (WHERE-guarded), condition,
  variable, terminate_workflow, try_catch, comment. Unsupported blocks
  emit visible '// [fixzy] not supported in v1' comments — never broken PHP.
- REMAINING GAPS (documented, not v1): LDAP, Google SSO (no packages in
  stack), send_email/whatsapp/telegram/http_request blocks (need external
  services), for_each_loop/data_transformer/switch (complex control flow).
- Tests: fixture workflow_hooks.json + goldens; e2e batch 21/21 boots.

### BUG-015 LDAP/Google SSO IMPLEMENTED (2026-09-22): plug-and-play auth integrations
- Owner directive: Fixzy must auto-implement selected auth features; trusted
  packages only. Chosen: laravel/socialite (official Laravel) +
  directorytree/ldaprecord-laravel (de-facto Laravel LDAP standard).
- New generator: src/generators/laravelAuthIntegrationsGenerator.js
  * Google SSO: GoogleController (redirect/callback, auto-provision,
    email-match linking), google_id migration, Socialite config pushed at
    runtime from DB settings.
  * LDAP: LdapAuthenticator service (service-account bind -> search ->
    user bind), local fallback preserved.
  * Shared: fixzy_settings key/value table + FixzySetting model.
  * Admin UI: System -> Auth Settings page (paste keys once; nothing
    hard-coded; env fallback supported).
  * fixzy-manifest.json in output declares composer packages + required
    PHP extensions.
- Login page unified: App\Filament\Auth\FixzyLogin combines captcha +
  LDAP (captcha validation always runs before LDAP fallback).
- AdminPanelProvider: "Sign in with Google" button via
  panels::auth.login.form.after render hook.
- Deploy flow (deploymentHandler.js): reads manifest, auto composer
  require per package, warns if PHP ext (ldap) missing.
- Preview flow (register.js): now also runs workflow hooks + auth
  integrations generators (parity with full-stack generator).
- Deployment Guide (English, feature-aware): SSO checklist, LDAP
  checklist (incl. php-ldap ext), Extra Login Security section,
  debug-mode-off warning. Sections render only for enabled features.
- preview_env: socialite + ldaprecord-laravel pre-installed
  (needed php8.5-intl + php8.5-ldap system packages).
- Verified: golden 17/17, e2e batch 21/21 (auth_ldap_sso boots with
  provider registered), php -l clean on all generated files.
- Remaining gaps (documented, need external services): send
  email/whatsapp/telegram automation blocks.

### BUG-016 WORKFLOW CODEGEN v2 (2026-09-22): popular blocks now generate real code
- Owner audit Q: "adakah semua elemen workflow berfungsi sepenuhnya?" Honest answer was NO —
  8 of 17 palette blocks compiled to skip-comments. Now implemented (Pilihan A + UI guard):
  * send_email -> Mail::raw with ##variable.x## interpolation (to/cc/bcc/subject/body)
  * http_request -> Http::timeout(15)->withHeaders(...)->get/post/put/patch/delete
  * data_transformer -> Date::parse->format / strtoupper-lowercase / math (validated, no eval)
  * for_each_loop -> foreach ((array) $list as $__wf_loopItem), continues out-complete
  * switch -> switch/case/default from connected out-case-N points
  * if/then/else_if/else -> nested parenthesized ternary in variable blocks
  * try_catch -> Catch branch now executes (was empty swallow)
  * on_startup -> runStartupWorkflow() in provider boot (was silently unmapped)
- Mail settings: generated app ships MailSettings page (System > Mail Settings) storing
  SMTP host/port/user/pass/encryption/from in fixzy_settings; WorkflowServiceProvider
  applies over .env at boot (Schema::hasTable guard). Test-send button included.
- UI guard: send_whatsapp, send_telegram, delay, advanced action now show
  "not generated" warning badge on the block in the designer (no more silent skip).
- PHP gotchas fixed during golden: use() needs plain vars (temp $__wf_*), nested ternary
  needs parens (PHP8), bare return; invalid in handle():int (mapped to SUCCESS).
- Fixture workflow_hooks extended to cover ALL new blocks. php -l 33/33, golden 17/17,
  e2e 21/21 PASS.
