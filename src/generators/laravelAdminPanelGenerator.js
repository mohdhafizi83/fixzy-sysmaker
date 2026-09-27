// AdminPanelProvider generator (Fixzy SysMaker).
//
// Renders app/Providers/Filament/AdminPanelProvider.php from the project
// config: navigation groups, tenancy, auth/MFA/captcha login class,
// realtime, dashboard class, and localization flags all map to template
// variables consumed by AdminPanelProvider.php.njk.
const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');

const TEMPLATE = 'app/Providers/Filament/AdminPanelProvider.php.njk';

/**
 * Generate AdminPanelProvider.php from project configuration.
 *
 * @param {Object} fullSchema - project info & menu groups
 * @param {string} basePath - output folder
 */
async function generateAdminPanelProvider(fullSchema, basePath) {
    try {
        const providersPath = path.join(basePath, 'app', 'Providers', 'Filament');
        if (!fs.existsSync(providersPath)) {
            fs.mkdirSync(providersPath, { recursive: true });
        }

        const project = fullSchema.project || {};

        // Navigation groups: prefer explicit menu_groups, fall back to
        // unified_menu group items (newer schema shape).
        let menuGroups = fullSchema.menu_groups || [];
        if (menuGroups.length === 0 && fullSchema.database && fullSchema.database.unified_menu) {
            menuGroups = fullSchema.database.unified_menu
                .filter((item) => item.type === 'group')
                .map((group) => ({ group_name: group.name, group_order: group.order }));
        }
        const navigationGroups = menuGroups
            .slice()
            .sort((a, b) => a.group_order - b.group_order)
            .map((g) => String(g.group_name ?? '').replace(/'/g, "\\'"));

        // Multi-tenancy: many_to_many with a tenant table -> ->tenant(Model::class)
        let tenantModel = null;
        if (project.tenancy_type === 'many_to_many' && project.tenant_table) {
            tenantModel = project.tenant_table
                .split('_')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join('');
        }

        const fileContent = renderTemplate(TEMPLATE, {
            module_log_audit: project.module_log_audit === 1,
            module_authorization: project.module_authorization === 1,
            top_navigation: project.menu_orientation === 'top',
            tenant_model: tenantModel,
            navigation_groups: navigationGroups,
            // Auth flags (BUG-015): native Filament MFA + captcha login.
            // Mode (b) selects the implementation: 'totp' = Google
            // Authenticator (Filament App MFA provider, recoverable codes),
            // otherwise the email one-time-code provider.
            mfa_provider: (() => {
                const authConfig = require('./authConfig');
                if (authConfig.isTotp(project)) {
                    return '\\Filament\\Auth\\MultiFactor\\App\\AppAuthentication::make()->recoverable()';
                }
                return Number(project.module_auth_email_2fa) === 1
                    ? '\\Filament\\Auth\\MultiFactor\\Email\\EmailAuthentication::make()'
                    : null;
            })(),
            login_class: (Number(project.module_auth_email_captcha) === 1
                || Number(project.module_auth_ldap) === 1
                || require('./authConfig').isRecaptcha(project))
                ? '\\App\\Filament\\Auth\\FixzyLogin::class'
                : null,
            recaptcha_login: require('./authConfig').isRecaptcha(project),
            google_sso: Number(project.module_auth_google_sso) === 1,
            ldap: Number(project.module_auth_ldap) === 1,
            // Real-time module (native Filament database notifications).
            realtime_enabled: Number(project.module_realtime) === 1,
            // Reports module: custom dashboard page that renders the
            // compiled report widgets (else stock Filament dashboard).
            dashboard_class: require('./reportConfig').anyReportsEnabled(fullSchema)
                ? '\\App\\Filament\\Pages\\FixzyDashboard'
                : null,
            // Localization module (Malay): locale middleware + switcher.
            localization_enabled: require('./localizationConfig').isLocalizationEnabled(project),
            // Theme system v1: neutral theme -> Filament color expression.
            // Presets map to named Filament palette constants; custom themes
            // pass the validated hex string (Filament generates the full
            // shade palette from it). resolveTheme() guarantees the hex is
            // #rgb/#rrggbb, so interpolation is injection-safe.
            theme_primary_expr: (() => {
                const { resolveTheme } = require('../core/theme');
                const theme = resolveTheme(project.theme_config);
                const PRESET_CONST = {
                    'fixzy-amber': 'Color::Amber',
                    'fixzy-emerald': 'Color::Emerald',
                    'fixzy-slate': 'Color::Slate',
                };
                if (theme.mode === 'custom') {
                    return `'${theme.primary}'`;
                }
                return PRESET_CONST[theme.preset] || 'Color::Amber';
            })(),
        });

        const outputPath = path.join(providersPath, 'AdminPanelProvider.php');
        fs.writeFileSync(outputPath, fileContent);
        return { success: true };
    } catch (error) {
        console.error("Failed to generate AdminPanelProvider:", error);
        return { success: false, message: error.message };
    }
}

module.exports = { generateAdminPanelProvider };
