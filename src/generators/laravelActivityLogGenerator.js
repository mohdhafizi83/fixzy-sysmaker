// User Activity Log module generator (Fixzy SysMaker)
//
// Emits the native "what users did in the app" log, controlled by
// project.module_log_activity (independent of module_log_audit):
//   * database/migrations/TS_create_activity_logs_table.php
//   * app/Models/ActivityLog.php
//   * app/Listeners/LogUserActivity.php
//   * app/Providers/ActivityLogServiceProvider.php  (registered in
//     bootstrap/providers.php when generating into a full app)
//   * app/Filament/Pages/ActivityLogPage.php + blade view (admin-only)
//
// The page shows sign-in activity always; when the Data Audit Trail
// (module_log_audit) is also on, a second tab reads the audits table so
// admins can see per-user data changes in the same screen.

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { getFormattedTimestamp } = require('../utils');

/** @param {object} fullSchema @returns {boolean} true when project.module_log_activity is on */
function isActivityLogEnabled(fullSchema) {
    const project = (fullSchema && fullSchema.project) || {};
    return Number(project.module_log_activity) === 1;
}

/** Write a file, creating the directory first. @param {string} dir target directory @param {string} filename file name @param {string} content file contents @returns {string} written file path */
function writeIf(dir, filename, content) {
    fs.mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, filename);
    fs.writeFileSync(outPath, content);
    return outPath;
}

/**
 * Generate the User Activity Log module (model, listener, provider, admin
 * page + view, migration) and register the provider in the manifest.
 * @param {object} fullSchema assembled project schema
 * @param {string} outputDir generated app root
 * @returns {{success: boolean, message: string}}
 */
function generateActivityLogModule(fullSchema, outputDir) {
    try {
        if (!isActivityLogEnabled(fullSchema)) {
            return { success: true, message: 'Activity log off — files skipped.' };
        }

        const project = fullSchema.project || {};
        const auditEnabled = Number(project.module_log_audit) === 1;
        const authorizationEnabled = Number(project.module_authorization) === 1;

        // Core files.
        writeIf(
            path.join(outputDir, 'app', 'Models'),
            'ActivityLog.php',
            renderTemplate('app/Models/ActivityLog.php.njk', {})
        );
        writeIf(
            path.join(outputDir, 'app', 'Listeners'),
            'LogUserActivity.php',
            renderTemplate('app/Listeners/LogUserActivity.php.njk', {})
        );
        writeIf(
            path.join(outputDir, 'app', 'Providers'),
            'ActivityLogServiceProvider.php',
            renderTemplate('app/Providers/ActivityLogServiceProvider.php.njk', {})
        );

        // Admin page + view. The page template needs to know whether the
        // Data Audit Trail exists (second tab) and whether Shield guards
        // access.
        writeIf(
            path.join(outputDir, 'app', 'Filament', 'Pages'),
            'ActivityLogPage.php',
            renderTemplate('app/Filament/Pages/ActivityLog.php.njk', {
                audit_enabled: auditEnabled,
                authorization_enabled: authorizationEnabled,
            })
        );
        writeIf(
            path.join(outputDir, 'resources', 'views', 'filament', 'pages'),
            'activity-log.blade.php',
            renderTemplate('resources/views/filament/pages/activity-log.blade.php.njk', {
                audit_enabled: auditEnabled,
            })
        );

        // Migration (idempotent: reuse existing audits-style timestamped file).
        const migrationsPath = path.join(outputDir, 'database', 'migrations');
        fs.mkdirSync(migrationsPath, { recursive: true });
        const existingMig = fs.existsSync(migrationsPath)
            ? fs.readdirSync(migrationsPath).find((f) => /_create_activity_logs_table\.php$/.test(f))
            : null;
        if (!existingMig) {
            const timestamp = getFormattedTimestamp(new Date(), 990);
            fs.writeFileSync(
                path.join(migrationsPath, `${timestamp}_create_activity_logs_table.php`),
                renderTemplate('database/migrations/create_activity_logs_table.php.njk', {})
            );
        }

        // Register provider in bootstrap/providers.php when generating into
        // a full app (same pattern as RealtimeServiceProvider).
        const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
        if (fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            if (!contents.includes('ActivityLogServiceProvider')) {
                contents = contents.replace(
                    /return\s*\[/,
                    'return [\n    App\\Providers\\ActivityLogServiceProvider::class,'
                );
                fs.writeFileSync(providersFile, contents);
            }
        }

        // Manifest: the deploy/preview flow registers providers from
        // fixzy-manifest.json into the staging app's bootstrap/providers.php.
        // Without this entry the listener never boots in a real app.
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
        const providerClass = 'App\\Providers\\ActivityLogServiceProvider';
        if (!manifest.providers.includes(providerClass)) manifest.providers.push(providerClass);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        return { success: true, message: 'User Activity Log module generated.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = { generateActivityLogModule, isActivityLogEnabled };
