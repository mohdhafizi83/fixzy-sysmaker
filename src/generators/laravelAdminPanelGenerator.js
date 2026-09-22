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
            // Auth flags (BUG-015): native Filament 4 email MFA + captcha login.
            mfa_provider: Number(project.module_auth_email_2fa) === 1
                ? '\\Filament\\Auth\\MultiFactor\\Email\\EmailAuthentication::make()'
                : null,
            login_class: (Number(project.module_auth_email_captcha) === 1
                || Number(project.module_auth_ldap) === 1)
                ? '\\App\\Filament\\Auth\\FixzyLogin::class'
                : null,
            google_sso: Number(project.module_auth_google_sso) === 1,
            ldap: Number(project.module_auth_ldap) === 1,
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
