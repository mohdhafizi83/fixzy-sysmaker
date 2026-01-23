const fs = require('fs');
const path = require('path');

// Fungsi helper untuk membaca template (konsisten dengan generator lain)
function readTemplate(relativePath) {
    const templatePath = path.join(__dirname, '..', 'templates', 'php', 'filament', relativePath);
    return fs.readFileSync(templatePath, 'utf8');
}

/**
 * Menjana AdminPanelProvider.php berdasarkan konfigurasi projek.
 * * @param {Object} fullSchema - Objek skema lengkap yang mengandungi info projek & menu_groups.
 * @param {string} basePath - Folder output (generated/filament_app_staging).
 */
async function generateAdminPanelProvider(fullSchema, basePath) {
    try {
        console.log("Menjana AdminPanelProvider...");

        // 1. Tentukan Laluan Folder Output
        const providersPath = path.join(basePath, 'app', 'Providers', 'Filament');
        
        // Pastikan folder wujud
        if (!fs.existsSync(providersPath)) {
            fs.mkdirSync(providersPath, { recursive: true });
        }

        // 2. Baca Template
        let templateContent = readTemplate('app/Providers/Filament/AdminPanelProvider.template');

        // 3. Dapatkan Data dari Schema
        const project = fullSchema.project;
        const menuGroups = fullSchema.menu_groups || []; // Pastikan array wujud

        // ============================================================
        // LOGIK PENGGANTIAN (REPLACEMENTS)
        // ============================================================

        // 1. LOG AUDIT (Import)
        // Placeholder: <<IMPORT_AUDITSRELATIONMANAGER>>
        let importAuditCode = '';
        if (project.module_log_audit === 1) {
            importAuditCode = `use Livewire\\Livewire;\nuse Tapp\\FilamentAuditing\\RelationManagers\\AuditsRelationManager;`;
        }
        templateContent = templateContent.replace(/<<IMPORT_AUDITSRELATIONMANAGER>>/g, importAuditCode);


        // 2. NAVIGATION GROUPS
        // Placeholder: <<NAVIGATIONGROUP>>
        // Logic: Loop menu_groups order by group_order
        let navigationGroupsCode = '';
        
        if (menuGroups.length > 0) {
            // Sort kumpulan mengikut group_order
            const sortedGroups = menuGroups.sort((a, b) => a.group_order - b.group_order);
            
            // Bina string kod
            const groupLines = sortedGroups.map(group => {
                // Escape single quotes dalam nama group jika ada
                const label = group.group_name.replace(/'/g, "\\'");
                return `                NavigationGroup::make()->label('${label}'),`;
            });
            
            navigationGroupsCode = groupLines.join('\n');
        }
        templateContent = templateContent.replace(/<<NAVIGATIONGROUP>>/g, navigationGroupsCode);


        // 3. MODULE AUTHORIZATION (Filament Shield)
        // Placeholder: <<FILAMENTSHIELDPLUGIN>>
        let shieldPluginCode = '';
        if (project.module_authorization === 1) {
            shieldPluginCode = `                FilamentShieldPlugin::make(),`;
        }
        templateContent = templateContent.replace(/<<FILAMENTSHIELDPLUGIN>>/g, shieldPluginCode);


        // 4. MENU ORIENTATION (Top Navigation)
        // Placeholder: <<TOPNAVIGATION>>
        let topNavCode = '';
        if (project.menu_orientation === 'top') {
            topNavCode = `            ->topNavigation()`;
        }
        templateContent = templateContent.replace(/<<TOPNAVIGATION>>/g, topNavCode);


        // 5. LOG AUDIT (Boot Component)
        // Placeholder: <<AUDITSRELATIONMANAGER>>
        let bootAuditCode = '';
        if (project.module_log_audit === 1) {
            bootAuditCode = `        Livewire::component('tapp.filament-auditing.relation-managers.audits-relation-manager', AuditsRelationManager::class);`;
        }
        templateContent = templateContent.replace(/<<AUDITSRELATIONMANAGER>>/g, bootAuditCode);


        // ============================================================
        // 4. TULIS FAIL OUTPUT
        // ============================================================
        const outputPath = path.join(providersPath, 'AdminPanelProvider.php');
        fs.writeFileSync(outputPath, templateContent);

        console.log(`[Success] AdminPanelProvider.php dijana di: ${outputPath}`);
        return { success: true };

    } catch (error) {
        console.error("Gagal menjana AdminPanelProvider:", error);
        return { success: false, message: error.message };
    }
}

module.exports = { generateAdminPanelProvider };