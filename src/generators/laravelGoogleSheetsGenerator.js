// Google Sheets Sync codegen (plug & play).
//
// Driven by project flag module_google_sheets + per-table flag
// google_sync_enabled (custom tables only — enforced in table:update).
//
// Scope (agreed):
//   - Two-way ADD & UPDATE. Sheet deletions are IGNORED (re-pushed).
//   - Polling every few minutes (runtime-configurable), not real-time.
//   - Service account auth; JSON uploaded via the generated settings
//     page, stored in storage/app/private (never in code/git).
//
// Generated pieces:
//   config/fixzy_sheets.php                    target/column map
//   app/Services/GoogleSheets/SyncService      create/push/pull engine
//   app/Jobs/PullGoogleSheetsJob              scheduled pull (add+update)
//   app/Providers/GoogleSheetsServiceProvider observers + schedule
//   app/Models/GoogleSheetSync                mapping table model
//   per synced table: sync_uuid migration, observer, Filament action
//   Filament settings page (credentials + share email + interval)
//
// The "Create Google Sheet" button on the listing is injected by
// laravelListGenerator (google_sync flag in PagesList template).
//
// A fixzy-manifest fragment is merged so deploy auto-requires
// google/apiclient.

'use strict';

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { toSingularPascalCase, toTitleCase } = require('../utils');

const CORE_BLOCKED_TABLES = ['users', 'sessions', 'jobs', 'failed_jobs', 'cache', 'password_reset_tokens', 'permissions', 'roles'];
const NEVER_SYNCED_FIELDS = ['created_at', 'updated_at', 'deleted_at', 'remember_token', 'sync_uuid', 'sheet_synced_at'];

function isSheetsEnabled(fullSchema) {
    return Number((fullSchema.project || {}).module_google_sheets) === 1;
}

/** Syncable = opted-in, not core, not feature-generated. */
function collectSyncedTables(fullSchema) {
    const tables = (fullSchema.database && fullSchema.database.table) || {};
    const out = [];
    for (const tableName in tables) {
        const t = tables[tableName];
        if (Number(t.google_sync_enabled) !== 1) continue;
        if (CORE_BLOCKED_TABLES.includes(tableName)) continue;
        if (t.feature_source && String(t.feature_source).trim() !== '') continue;
        out.push({ tableName, tableData: t });
    }
    return out;
}

/** Map a Fixzy field data_type to a sheet sync type. */
function sheetTypeOf(field) {
    const type = String(field.data_type || '').toUpperCase();
    if (['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].includes(type)) return 'number';
    if (type === 'BOOLEAN' || (type === 'TINYINT' && Number(field.length) === 1)) return 'bool';
    if (type === 'DATE') return 'date';
    if (type === 'DATETIME' || type === 'TIMESTAMP') return 'datetime';
    return 'text';
}

function buildColumns(tableData) {
    const cols = [];
    for (const field of Object.values(tableData.fields || {})) {
        const name = field.field_name;
        if (!name || NEVER_SYNCED_FIELDS.includes(name)) continue;
        // Never sync primary/auto-increment keys — sheet identity is sync_uuid.
        if (Number(field.primary_key) === 1 || Number(field.auto_increment) === 1) continue;
        // Skip structured/multi-value fields (repeaters, file uploads) —
        // they cannot be safely edited as a single sheet cell.
        const dt = String(field.display_type || '');
        if (dt.startsWith('repeater') || dt.includes('file') || dt.includes('image')) continue;
        const header = String(field.caption || field.field_label || name)
            .replace(/[\r\n]+/g, ' ')
            .replace(/'/g, '’')
            .trim();
        cols.push({ field: name, header: header || name, type: sheetTypeOf(field) });
    }
    return cols;
}

function writeIf(dir, file, content) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
}

function mergeManifest(outputDir, composerPackages, providers) {
    const manifestPath = path.join(outputDir, 'fixzy-manifest.json');
    let manifest = { composer: [], php_extensions: [], npm: [], providers: [] };
    if (fs.existsSync(manifestPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            manifest = {
                composer: Array.isArray(existing.composer) ? existing.composer : [],
                php_extensions: Array.isArray(existing.php_extensions) ? existing.php_extensions : [],
                npm: Array.isArray(existing.npm) ? existing.npm : [],
                providers: Array.isArray(existing.providers) ? existing.providers : [],
            };
        } catch (e) {
            // Corrupt manifest: start fresh rather than crash the build.
        }
    }
    for (const pkg of composerPackages) if (!manifest.composer.includes(pkg)) manifest.composer.push(pkg);
    for (const prov of providers) if (!manifest.providers.includes(prov)) manifest.providers.push(prov);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

const POLL_INTERVAL_MINUTES = 5;

function generateGoogleSheetsModule(fullSchema, outputDir) {
    try {
        if (!isSheetsEnabled(fullSchema)) {
            return { success: true, composerPackages: [], syncedTables: [] };
        }

        const synced = collectSyncedTables(fullSchema);
        if (synced.length === 0) {
            console.warn('[gsheets] module enabled but no custom table opted in — nothing generated.');
            return { success: true, composerPackages: [], syncedTables: [] };
        }

        // FixzySetting model + table (shared infra; idempotent).
        const settingsModel = path.join(outputDir, 'app', 'Models', 'FixzySetting.php');
        if (!fs.existsSync(settingsModel)) {
            writeIf(
                path.join(outputDir, 'app', 'Models'),
                'FixzySetting.php',
                renderTemplate('app/Models/FixzySetting.php.njk', {})
            );
            const migDir = path.join(outputDir, 'database', 'migrations');
            const migFile = path.join(migDir, '2026_09_22_000001_create_fixzy_settings_table.php');
            if (!fs.existsSync(migFile)) {
                writeIf(
                    migDir,
                    '2026_09_22_000001_create_fixzy_settings_table.php',
                    renderTemplate('database/migrations/create_fixzy_settings_table.php.njk', {})
                );
            }
        }

        // Mapping table + model.
        writeIf(
            path.join(outputDir, 'database', 'migrations'),
            '2026_09_23_100001_create_google_sheet_syncs_table.php',
            renderTemplate('database/migrations/create_google_sheet_syncs_table.php.njk', {})
        );
        writeIf(
            path.join(outputDir, 'app', 'Models'),
            'GoogleSheetSync.php',
            renderTemplate('app/Models/GoogleSheetSync.php.njk', {})
        );

        // Per synced table: identity columns, observer, action class.
        const targets = [];
        for (const { tableName, tableData } of synced) {
            const nameSource = (tableData.module_name && tableData.module_name.trim() !== '')
                ? tableData.module_name : tableName;
            const modelShort = toSingularPascalCase(nameSource);
            const columns = buildColumns(tableData);
            if (columns.length === 0) {
                console.warn(`[gsheets] table '${tableName}' has no syncable columns — skipped.`);
                continue;
            }

            const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
            writeIf(
                path.join(outputDir, 'database', 'migrations'),
                `2026_09_23_100002_add_sync_columns_to_${safeTable}_table.php`,
                renderTemplate('database/migrations/add_sync_columns_to_table.php.njk', { table_name: tableName })
            );
            writeIf(
                path.join(outputDir, 'app', 'Observers'),
                `GoogleSheetsSync${modelShort}Observer.php`,
                renderTemplate('app/Observers/GoogleSheetsSyncModelObserver.php.njk', {
                    model_class: modelShort,
                    table_key: modelShort,
                })
            );
            writeIf(
                path.join(outputDir, 'app', 'Filament', 'Actions'),
                `CreateGoogleSheet${modelShort}Action.php`,
                renderTemplate('app/Filament/Actions/CreateGoogleSheetAction.php.njk', {
                    model_class: modelShort,
                    table_key: modelShort,
                })
            );

            targets.push({
                key: modelShort,
                model_class: `App\\Models\\${modelShort}`,
                model_short: modelShort,
                title: toTitleCase(nameSource),
                columns,
            });
        }

        if (targets.length === 0) {
            return { success: true, composerPackages: [], syncedTables: [] };
        }

        // Config + engine + job + provider.
        writeIf(
            path.join(outputDir, 'config'),
            'fixzy_sheets.php',
            renderTemplate('config/fixzy_sheets.php.njk', { targets, poll_interval: POLL_INTERVAL_MINUTES })
        );
        writeIf(
            path.join(outputDir, 'app', 'Services', 'GoogleSheets'),
            'GoogleSheetsSyncService.php',
            renderTemplate('app/Services/GoogleSheets/GoogleSheetsSyncService.php.njk', {})
        );
        writeIf(
            path.join(outputDir, 'app', 'Jobs'),
            'PullGoogleSheetsJob.php',
            renderTemplate('app/Jobs/PullGoogleSheetsJob.php.njk', {})
        );
        writeIf(
            path.join(outputDir, 'app', 'Providers'),
            'GoogleSheetsServiceProvider.php',
            renderTemplate('app/Providers/GoogleSheetsServiceProvider.php.njk', {
                targets,
                poll_interval: POLL_INTERVAL_MINUTES,
            })
        );

        // Settings page (credentials + share email + interval).
        writeIf(
            path.join(outputDir, 'app', 'Filament', 'Pages'),
            'GoogleSheetsSettings.php',
            renderTemplate('app/Filament/Pages/GoogleSheetsSettings.php.njk', {
                poll_interval: POLL_INTERVAL_MINUTES,
            })
        );
        writeIf(
            path.join(outputDir, 'resources', 'views', 'filament', 'pages'),
            'google-sheets-settings.blade.php',
            renderTemplate('resources/views/filament/pages/google-sheets-settings.blade.php.njk', {})
        );

        // Register provider in bootstrap/providers.php when generating into a full app.
        const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
        if (fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            if (!contents.includes('GoogleSheetsServiceProvider')) {
                contents = contents.replace(
                    /return\s*\[/,
                    'return [\n    App\\Providers\\GoogleSheetsServiceProvider::class,'
                );
                fs.writeFileSync(providersFile, contents);
            }
        }

        // Deploy manifest: composer package + provider registration.
        mergeManifest(outputDir, ['google/apiclient'], ['App\\Providers\\GoogleSheetsServiceProvider']);

        return {
            success: true,
            composerPackages: ['google/apiclient'],
            syncedTables: targets.map((t) => t.key),
        };
    } catch (error) {
        console.error('Failed to generate Google Sheets sync module:', error);
        return { success: false, message: error.message };
    }
}

module.exports = { generateGoogleSheetsModule, isSheetsEnabled, collectSyncedTables, sheetTypeOf };
