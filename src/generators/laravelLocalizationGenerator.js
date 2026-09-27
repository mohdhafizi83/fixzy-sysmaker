// laravelLocalizationGenerator.js — emits the Localization module when
// the project selects Malay (projects.language_select === "Malay"):
//   - app/Http/Middleware/SetLocale.php (session-driven App::setLocale)
//   - app/Providers/LocalizationServiceProvider.php (switch route)
//   - resources/views/filament/locale-switcher.blade.php (EN/BM pills)
//   - lang/en.json + lang/ms.json (generated captions & labels)
// English projects emit NOTHING (byte-identical to pre-module output).
// Filament v5 ships native ms translations for its own chrome, so the
// panel UI (buttons, pagination, validation chrome) localizes for free
// once App::setLocale('ms') runs.

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { isLocalizationEnabled, defaultLocale, collectLocalizationStrings } = require('./localizationConfig');

/**
 * Generate the Localization module (middleware, provider, switcher view,
 * en/ms JSON) when the project selects Malay.
 * @param {object} fullSchema assembled project schema
 * @param {string} outputDir generated app root
 * @returns {{success: boolean, files: string[], skipped?: boolean, error?: string, message?: string}}
 */
function generateLocalizationModule(fullSchema, outputDir) {
    try {
        if (!isLocalizationEnabled(fullSchema.project || {})) {
            return { success: true, files: [], skipped: true };
        }

        const written = [];
        /** Write generated content to outputDir/relPath and track it. @param {string} relPath @param {string} content @returns {void} */
        const emit = (relPath, content) => {
            const abs = path.join(outputDir, relPath);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, content);
            written.push(relPath);
        };

        // Middleware + provider + switcher view.
        emit(path.join('app', 'Http', 'Middleware', 'SetLocale.php'),
            renderTemplate('app/Http/Middleware/SetLocale.php.njk', {
                default_locale: defaultLocale(fullSchema.project || {}),
            }));
        emit(path.join('app', 'Providers', 'LocalizationServiceProvider.php'),
            renderTemplate('app/Providers/LocalizationServiceProvider.php.njk', {}));
        emit(path.join('resources', 'views', 'filament', 'locale-switcher.blade.php'),
            renderTemplate('resources/views/filament/locale-switcher.blade.php.njk', {}));

        // Translation JSON (generated captions). Keys are stable
        // (fixzy.<table>.<field>) so re-generating is idempotent.
        const { en, ms } = collectLocalizationStrings(fullSchema);
        emit(path.join('lang', 'en.json'), JSON.stringify(en, null, 2) + '\n');
        emit(path.join('lang', 'ms.json'), JSON.stringify(ms, null, 2) + '\n');

        // Register provider in bootstrap/providers.php (same pattern as
        // AttachmentServiceProvider).
        const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
        if (fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            if (!contents.includes('LocalizationServiceProvider')) {
                contents = contents.replace(
                    /return\s*\[/,
                    'return [\n    App\\Providers\\LocalizationServiceProvider::class,'
                );
                fs.writeFileSync(providersFile, contents);
            }
        }

        // Manifest for the deploy/preview flow.
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
        const providerClass = 'App\\Providers\\LocalizationServiceProvider';
        if (!manifest.providers.includes(providerClass)) {
            manifest.providers.push(providerClass);
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        return { success: true, files: written };
    } catch (error) {
        return { success: false, error: error.message, message: error.message };
    }
}

module.exports = { generateLocalizationModule };
