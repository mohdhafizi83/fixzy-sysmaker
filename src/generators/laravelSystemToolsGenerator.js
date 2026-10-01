// laravelSystemToolsGenerator.js — emits the "System" module files that
// back the rebuilt Security & technical options (2026-10-01):
//
//   allow_server_status  -> app/Filament/Pages/ServerStatus.php
//                          + resources/views/filament/pages/server-status.blade.php
//   allow_pwa_install    -> public/manifest.webmanifest + public/fixzy-pwa-sw.js
//                          + PWA icons + head renderHook (via AdminPanelProvider)
//
// admins_group_access is implemented in the DatabaseSeeder (Shield 'admins'
// role with full permissions) — see laravelDatabaseGenerator.js.
//
// All emits are idempotent (skip existing files), same convention as the
// Scheduler module.

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { resolveTheme } = require('../core/theme');

/**
 * True when the project enables the server status page.
 * @param {object} fullSchema assembled project schema
 * @returns {boolean}
 */
function serverStatusEnabled(fullSchema) {
    return Number((fullSchema.project || {}).allow_server_status) === 1;
}

/**
 * True when the project enables PWA install.
 * @param {object} fullSchema assembled project schema
 * @returns {boolean}
 */
function pwaEnabled(fullSchema) {
    return Number((fullSchema.project || {}).allow_pwa_install) === 1;
}

/**
 * Generate the System module files (server status page, PWA shell).
 * @param {object} fullSchema assembled project schema
 * @param {string} outputDir generated app root
 * @returns {{success: boolean, files: string[], skipped?: boolean, message?: string}}
 */
function generateSystemToolsModule(fullSchema, outputDir) {
    try {
        const written = [];

        /** Render a template once (idempotent: skips existing files). */
        const emit = (relPath, template, context) => {
            const abs = path.join(outputDir, relPath);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            if (fs.existsSync(abs)) return;
            fs.writeFileSync(abs, renderTemplate(template, context || {}));
            written.push(relPath);
        };

        if (serverStatusEnabled(fullSchema)) {
            emit(path.join('app', 'Filament', 'Pages', 'ServerStatus.php'),
                'app/Filament/Pages/ServerStatus.php.njk');
            emit(path.join('resources', 'views', 'filament', 'pages', 'server-status.blade.php'),
                'resources/views/filament/pages/server-status.blade.php.njk');
        }

        if (pwaEnabled(fullSchema)) {
            const project = fullSchema.project || {};
            const theme = resolveTheme(project.theme_config);
            const appTitle = String(project.app_title || 'Admin').replace(/"/g, '&quot;');
            const shortName = appTitle.length > 20 ? appTitle.slice(0, 20) : appTitle;
            emit(path.join('public', 'manifest.webmanifest'),
                'public/manifest.webmanifest.njk',
                { app_title: appTitle, app_short: shortName, theme_hex: theme.primary });
            emit(path.join('public', 'fixzy-pwa-sw.js'),
                'public/fixzy-pwa-sw.js.njk');

            // PWA icons: copy from the generator's own assets (binary PNGs
            // can't go through the text template engine).
            const iconPairs = [
                ['icon-192.png', 'pwa-icon-192.png'],
                ['icon-512.png', 'pwa-icon-512.png'],
            ];
            for (const [srcName, destName] of iconPairs) {
                const src = path.join(__dirname, '..', '..', 'assets', 'pwa', srcName);
                const dest = path.join(outputDir, 'public', destName);
                if (fs.existsSync(src) && !fs.existsSync(dest)) {
                    fs.mkdirSync(path.dirname(dest), { recursive: true });
                    fs.copyFileSync(src, dest);
                    written.push(path.join('public', destName));
                }
            }
        }

        if (written.length === 0) {
            return { success: true, files: [], skipped: true };
        }
        return { success: true, files: written };
    } catch (error) {
        return { success: false, files: [], message: error.message };
    }
}

module.exports = {
    generateSystemToolsModule,
    serverStatusEnabled,
    pwaEnabled,
};
