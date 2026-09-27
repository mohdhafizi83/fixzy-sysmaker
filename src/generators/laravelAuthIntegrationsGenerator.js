// Auth integrations codegen (plug & play).
//
// Driven by project flags module_auth_google_sso / module_auth_ldap:
//
//   Google SSO  -> laravel/socialite (official Laravel package)
//                  + GoogleController (redirect/callback)
//                  + google_id column on users
//   LDAP        -> directorytree/ldaprecord-laravel (de-facto standard)
//                  + LdapAuthenticator service (bind + lookup)
//
// Credentials (client id/secret, LDAP host/bind) are NEVER baked into
// code: the generated app ships an "Auth Settings" page where the admin
// pastes them once; they are stored in the fixzy_settings table and read
// at runtime (env fallback supported).
//
// A fixzy-manifest.json is written into the output so the deploy flow
// knows which composer packages / PHP extensions to install automatically.

'use strict';

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');

/** @param {object} fullSchema @returns {boolean} true when Google SSO flag is on */
function hasGoogle(fullSchema) {
    return Number((fullSchema.project || {}).module_auth_google_sso) === 1;
}

/** @param {object} fullSchema @returns {boolean} true when LDAP flag is on */
function hasLdap(fullSchema) {
    return Number((fullSchema.project || {}).module_auth_ldap) === 1;
}

/** @param {object} fullSchema @returns {boolean} true when 2FA mode is TOTP */
function hasTotp(fullSchema) {
    return require('./authConfig').isTotp(fullSchema.project);
}

/** @param {object} fullSchema @returns {boolean} true when captcha mode is reCAPTCHA v2 */
function hasRecaptcha(fullSchema) {
    return require('./authConfig').isRecaptcha(fullSchema.project);
}

/** Write a file, creating the directory first. @param {string} dir target directory @param {string} file file name @param {string} content contents @returns {void} */
function writeIf(dir, file, content) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
}

/**
 * Generate auth integration files (Google SSO, LDAP, TOTP columns,
 * reCAPTCHA service, settings page) per project flags, plus the manifest.
 * @param {object} fullSchema assembled project schema
 * @param {string} outputDir generated app root
 * @returns {{success: boolean, composerPackages: string[], phpExtensions: string[], message?: string}}
 */
function generateAuthIntegrations(fullSchema, outputDir) {
    try {
        const google = hasGoogle(fullSchema);
        const ldap = hasLdap(fullSchema);
        const totp = hasTotp(fullSchema);
        const recaptcha = hasRecaptcha(fullSchema);

        if (!google && !ldap && !totp && !recaptcha) {
            return { success: true, composerPackages: [], phpExtensions: [] };
        }

        const composerPackages = [];
        const phpExtensions = [];

        // Shared settings store (key/value) — used by SSO and LDAP alike.
        writeIf(
            path.join(outputDir, 'database', 'migrations'),
            '2026_09_22_000001_create_fixzy_settings_table.php',
            renderTemplate('database/migrations/create_fixzy_settings_table.php.njk', {})
        );
        writeIf(
            path.join(outputDir, 'app', 'Models'),
            'FixzySetting.php',
            renderTemplate('app/Models/FixzySetting.php.njk', {})
        );

        if (google) {
            composerPackages.push('laravel/socialite');
            writeIf(
                path.join(outputDir, 'database', 'migrations'),
                '2026_09_22_000002_add_google_id_to_users_table.php',
                renderTemplate('database/migrations/add_google_id_to_users_table.php.njk', {})
            );
            writeIf(
                path.join(outputDir, 'app', 'Http', 'Controllers', 'Auth'),
                'GoogleController.php',
                renderTemplate('app/Http/Controllers/Auth/GoogleController.php.njk', {})
            );
        }

        if (ldap) {
            composerPackages.push('directorytree/ldaprecord-laravel');
            phpExtensions.push('ldap');
            writeIf(
                path.join(outputDir, 'app', 'Services'),
                'LdapAuthenticator.php',
                renderTemplate('app/Services/LdapAuthenticator.php.njk', {})
            );
        }

        // Google Authenticator (TOTP) 2FA: users table columns for the
        // encrypted secret + hashed recovery codes. The provider itself is
        // Filament's native AppAuthentication (no extra composer package).
        if (totp) {
            writeIf(
                path.join(outputDir, 'database', 'migrations'),
                '2026_09_25_000003_add_totp_columns_to_users_table.php',
                renderTemplate('database/migrations/add_totp_columns_to_users_table.php.njk', {})
            );
        }

        // Google reCAPTCHA v2: server-side verification service. Keys are
        // pasted on the Auth Settings page (never baked into code).
        if (recaptcha) {
            writeIf(
                path.join(outputDir, 'app', 'Services'),
                'RecaptchaService.php',
                renderTemplate('app/Services/RecaptchaService.php.njk', {})
            );
        }

        // Provider: wires routes + runtime config from the settings table.
        writeIf(
            path.join(outputDir, 'app', 'Providers'),
            'AuthIntegrationsServiceProvider.php',
            renderTemplate('app/Providers/AuthIntegrationsServiceProvider.php.njk', {
                google,
                ldap,
            })
        );

        // Admin-facing settings page (pasted keys live here, not in code).
        // TOTP alone needs no keys, so skip the page unless a keyed
        // integration (SSO / LDAP / reCAPTCHA) is enabled.
        if (google || ldap || recaptcha) {
        writeIf(
            path.join(outputDir, 'app', 'Filament', 'Pages'),
            'AuthSettings.php',
            renderTemplate('app/Filament/Pages/AuthSettings.php.njk', {
                google,
                ldap,
                recaptcha,
            })
        );
        writeIf(
            path.join(outputDir, 'resources', 'views', 'filament', 'pages'),
            'auth-settings.blade.php',
            renderTemplate('resources/views/filament/pages/auth-settings.blade.php.njk', {
                google,
                ldap,
                recaptcha,
            })
        );
        }

        // Register in bootstrap/providers.php when generating into a full app.
        const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
        if (fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            if (!contents.includes('AuthIntegrationsServiceProvider')) {
                contents = contents.replace(
                    /return\s*\[/,
                    'return [\n    App\\Providers\\AuthIntegrationsServiceProvider::class,'
                );
                fs.writeFileSync(providersFile, contents);
            }
        }

        // Manifest for the deploy flow (auto composer require + ext warning).
        fs.writeFileSync(
            path.join(outputDir, 'fixzy-manifest.json'),
            JSON.stringify({ composer: composerPackages, php_extensions: phpExtensions, providers: ['App\\Providers\\AuthIntegrationsServiceProvider'] }, null, 2)
        );

        return { success: true, composerPackages, phpExtensions };
    } catch (error) {
        console.error('Failed to generate auth integrations:', error);
        return { success: false, message: error.message };
    }
}

module.exports = { generateAuthIntegrations, hasGoogle, hasLdap, hasTotp, hasRecaptcha };
