# Changelog

All notable changes to **Fixzy SysMaker** are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions are tagged as `vX.Y.Z` on GitHub. Sections are generated from the
commit log between release tags.

## [1.0.14] - 2026-10-04

- test(capstone): fasa 28 full acceptance journey, 100% green
- test(fasa27): version-upgrade integrity + IR round-trip harnesses
- fix(gui): debounce New Table/New Field buttons against rapid double-clicks
- fix(workflow): namespace-qualify auth event classes in project hook listeners
- fix(workflow,kanban): register WorkflowServiceProvider in manifest, guard mail settings boot, scope kanban queries
- test(fasa23): scoping, approvals, numbering, public form runtime audit
- fix(importers): add nullable rule to optional import columns
- fix(generators): execute calculated queries, real CURRENT_TIMESTAMP defaults, lock computed fields
- fix(generators): enforce read_only on all components, fix attachments count badge
- docs(readme): point download table at v1.0.13 stable installers

**Full Changelog**: https://github.com/mohdhafizi83/fixzy-sysmaker/compare/v1.0.13...v1.0.14

## [1.0.13] - 2026-10-04

- chore(ui): remove vestigial controls with zero code references
- fix(deploy): repair update/deploy pipeline found via live Electron audit (Fasa 14)
- docs(readme): point download table at v1.0.13-rc installers
- fix(renderer): live-audit fixes for lookup query, menu OK, grid routing, auto-default
- docs(readme): point download table at v1.0.12-rc installers
- fix(sidebar): preserve table/field selection across menu rebuilds; +Table focus
- fix(preview,packaging): live HTML template mocks; ship renderer assets in installers
- docs(readme): point download table at v1.0.11-rc installers
- fix(settings): runtime dropdown fill, Models-Design save routing, zoom-dependency persist
- docs(readme): point download table at v1.0.10-rc installers
- fix(hooks): repair table-hook save key and cross-table canvas carry-over
- docs(readme): point download table at v1.0.9-rc installers
- fix(dashboard-builder): restore missing Save button and repair widget:save UPDATE bindings
- docs(readme): point download table at v1.0.8-rc installers
- fix(modules-setup): repair 3 bugs found in live Electron audit
- fix(models-design): repair 6 bugs found in live Electron audit
- fix(tenancy): repair Architecture & Multi-Tenancy tab bugs found in live audit
- docs(readme): point download table at v1.0.7 installers

**Full Changelog**: https://github.com/mohdhafizi83/fixzy-sysmaker/compare/v1.0.7...v1.0.13

## [1.0.7] - 2026-10-02

- feat(menu): wire all Menu Management options into the generator
- chore(ui): remove dead stack_theme dropdown from Technologies Stack tab
- docs(readme): point download table at v1.0.6 installers

**Full Changelog**: https://github.com/mohdhafizi83/fixzy-sysmaker/compare/v1.0.6...v1.0.7

## [1.0.6] - 2026-10-02

- feat(localization): wire locale + timezone end-to-end
- docs(readme): point download table at v1.0.5 installers (all URLs verified 200)

**Full Changelog**: https://github.com/mohdhafizi83/fixzy-sysmaker/compare/v1.0.5...v1.0.6

## [1.0.5] - 2026-10-02

- feat(settings): wire dead preferences into real consumers; remove 7 legacy knobs
- docs(readme): fix installer filenames to 1.0.4 (were 1.0.2 names under v1.0.4 URLs = 404)
- fix(ci): track assets/pwa icons — gitignore /assets hid generator's PWA icon sources
- docs(readme): point download table at v1.0.4 installers

**Full Changelog**: https://github.com/mohdhafizi83/fixzy-sysmaker/compare/v1.0.4...v1.0.5

## [1.0.4] - 2026-10-01

### What's new since v1.0.3

The **Security & technical** tab is rebuilt — every option in it now actually generates into your app:

- **Admins group access** — the seeder creates an `admins` Shield role holding every permission; assign any user to it for full admin access with zero per-user permission work.
- **Server status page** — a read-only `/admin/server-status` page: PHP version and limits, required extensions, Laravel environment, disk/memory headroom, queue backlog. Admin-gated.
- **PWA install** — your admin panel becomes installable on phones and desktops: generated web manifest, service worker, and icons, themed with your chosen color.

Five legacy switches that never affected generated output (hide-login, interactive SQL tool, table-list SQL view, copy-children-async, application URL) were removed — no more dead options.

- feat(generated-app): rebuild Security & technical tab with working options
- docs(readme): point download table at v1.0.3 installers

**Full Changelog**: https://github.com/mohdhafizi83/fixzy-sysmaker/compare/v1.0.3...v1.0.4

## [1.0.3] - 2026-10-01

- feat(gui): remove Security & technical tab (options never implemented in generated apps)
- docs(readme): prominent installer download table at top
- chore(license): relicense to Apache-2.0 with trademark notice
- fix(handlers): sync table_view_title when module is renamed
- fix(generators): treat captured DEFAULT NULL as no-default
- fix(ci): use Node 22 to match release workflow

**Full Changelog**: https://github.com/mohdhafizi83/fixzy-sysmaker/compare/v1.0.2...v1.0.3

## [1.0.2] - 2026-10-01

- feat(public-form): full control-type matrix + media uploads, live browser verified

**Full Changelog**: https://github.com/mohdhafizi83/fixzy-sysmaker/compare/v1.0.1...v1.0.2

## [1.0.1] - 2026-10-01

- fix(grid-views): inline-edit columns lost searchable modifier
- fix(grid-views): custom-module model resolution, kanban Livewire target, inline-edit auth
- test(relation-managers): full element sweep inside RM child forms
- fix(media): MIME types for FileUpload acceptedFileTypes + storage:link in deploy guide
- fix(relation-managers): tab titles + column imports for tv_template overrides
- fix(tables,custom-modules): paginationMode enum + CM round-trip test suite
- fix(forms): DECIMAL validation, DATETIME picker, array casts, Radio/lookup support
- fix(forms): FK dropdown eye button never appears after selection
- fix(sql-import): UNSIGNED type matching, multi-FK relation naming, DECIMAL precision cap
- ci: fix verify-install helper check — helpers share the main process name on Windows
- ci: verify-install workflow — real-Windows E2E proof of the shipped installer

**Full Changelog**: https://github.com/mohdhafizi83/fixzy-sysmaker/compare/v1.0.0...v1.0.1

## [1.0.0] - 2026-09-30

- ci: use Node 22 in release workflow (ABI 127 has better-sqlite3 prebuilds; Node 20 ABI 115 has none and node-gyp 9 is broken on Python 3.12+)
- build: desktop installers for Windows/macOS/Linux + release workflow
- feat(ui): AppGini-style contextual help panel + full showcase screenshots
- chore(test): portable Chromium resolution for screenshot scripts
- feat(mcp): MCP server for AI-agent-driven generation (fixzy mcp)
- fix(ui): make Theme tab reachable + fix stuck-autosave TDZ bug
- test(db): rebase golden for engine-aware deployment guide (97/97 PASS)
- feat(db): Tier 1+2 database support - engine-aware env, deploy, guide
- docs(theme): Phase D - theme contract in IR_MAPPING, feature matrix section O, README 94 fixtures
- feat(theme): Phase C - Filament generator maps neutral theme to panel colors
- feat(theme): Phase B - Theme tab rebuilt (presets + custom picker + swatch)
- feat(theme): Phase A - neutral theme storage + IR contract
- docs(7.7a): coverage gates in FEATURE_MATRIX, README fixture counts, roadmap status
- test(7.7a): close all 16 branch-coverage gaps with targeted fixtures
- test(7.7a): fix IR-fixture crash in coverage probe, remove orphan CaptchaLogin template, add branch-level coverage harness
- docs: full documentation sweep + mandatory attribution banner in generated code
- feat(templates): mobile-friendly responsive layout for generated app UI
- fix(viz): browser-verified live mode + immersive kiosk + README screenshots
- feat(viz): real-time data visualization — 10 chart types, live/poll refresh, kiosk mode
- fix(preview_env): add softDeletes() to users migration to match SoftDeletes trait
- feat(setup): preview environment download-on-first-run
- test(card-preview): extract buildGridFeaturePreviewHtml too
- feat(presets): Starter Packs — declarative JSON templates installed onto the custom module engine
- feat(layout): per-relation child table/form overrides + global child layout defaults
- feat(preview): gate Show Preview button on PHP availability with per-OS install help
- …and 366 more changes — see the full compare log below.
