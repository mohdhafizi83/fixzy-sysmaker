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
