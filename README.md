# FiziSysMaker

**Ultimate Data Management System Maker.** Describe your database — get a complete
Laravel + Filament admin system: migrations, models, resources, forms, tables,
importers, exporters, audit trail, tenancy, factories, and docs. Generated code is
plain app code — no proprietary runtime, no lock-in.

Runs three ways from one engine: **desktop (Electron)**, **browser (local web UI)**,
and **headless CLI**.

---

## Quick start

```bash
npm install
npm run setup:binaries     # provisions PHP + composer.phar for your OS
npm start                  # desktop (Electron)
# or
node bin/fizisysmaker.js serve            # web UI at http://127.0.0.1:7788
node bin/fizisysmaker.js generate \
    --fixture base_simple --out ~/projects --zip   # headless
```

Requirements: Node 20+, and PHP 8.2+ for live preview/deploy (generators alone
need no PHP). See `docs/HEADLESS_WEB.md`.

## What you get per generated app

| Layer | Output |
|---|---|
| Database | Migrations (FKs, indexes, soft deletes), seeders, factories |
| Models | Eloquent models with relations, `BelongsToTenant` / `HasAudits` traits |
| Admin UI | Filament resources: forms, tables, pages, relation managers |
| Data I/O | CSV importers/exporters per table, native print action |
| Security | Native audit trail (migration + observer), tenancy scoping, Shield-ready |
| Docs | In-app deployment guide |

## Feature matrix

See `docs/FEATURE_MATRIX.md` — every axis (tenancy, relations, field types,
import/export, auditing, custom modules, menus) mapped to a golden fixture.

## Modes

- **Desktop** — `npm start`. Electron shell, same renderer.
- **Web** — `fizisysmaker serve`. Same UI in any browser on localhost;
  every IPC call exposed as `POST /ipc/<channel>` + SSE events.
  Remote binding requires `FSM_ALLOW_REMOTE=1` (LAN-only by design).
- **Headless** — `fizisysmaker generate --project <name> --out <dir> [--zip]`
  or `--fixture <name>` for CI. Output paths are allowlisted
  (`FSM_OUTPUT_ROOTS`, default `~/projects:$HOME`); traversal/symlink escapes
  are rejected.

## Development

```bash
node test/golden.js               # 16-fixture snapshot matrix
node test/e2e_smoke.js <fixture>  # generate + migrate + boot + HTTP check
node test/pathguard_test.js       # security unit tests
node test/audit_headless.js       # generator crash audit
```

CI runs the full matrix on ubuntu + macos (`.github/workflows/ci.yml`).

Key docs: `docs/FEATURE_MATRIX.md`, `docs/NATIVE_FEATURES.md`,
`docs/HEADLESS_WEB.md`, `docs/BUGS.md`,
`.hermes/plans/2026-09-21_051631-fizisysmaker-platform-rebuild.md`.

## Packaging

`electron-builder.yml` ships Windows (NSIS) and macOS (DMG, x64+arm64) targets,
unsigned by default. Codesign/notarize documented but optional (needs an Apple
Developer account). PHP is never bundled — resolved via `FSM_PHP_BIN`, the
provisioned `bin/php-8.4.12/`, or system PATH.

## License

TBD (owner decision).
