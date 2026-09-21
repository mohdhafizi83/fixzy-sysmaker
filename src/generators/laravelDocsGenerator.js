const fs = require('fs');
const path = require('path');

const { renderTemplate } = require('../render/engine');

async function generateDeploymentGuidePage(fullSchema, basePath) {
    try {
        console.log("Generating Deployment Guide from Templates...");

        // 1. Tentukan Laluan Folder Output
        const pagesDir = path.join(basePath, 'app', 'Filament', 'Pages');
        const viewsDir = path.join(basePath, 'resources', 'views', 'filament', 'pages');

        if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });
        if (!fs.existsSync(viewsDir)) fs.mkdirSync(viewsDir, { recursive: true });

        // 2. Context data (JS supplies data only; template owns the layout)
        const appDbName = fullSchema.project.app_title
            ? fullSchema.project.app_title.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
            : 'nama_db_anda';

        // 3. JANA PHP CLASS (DeploymentGuide.php)
        const phpOut = renderTemplate('app/Filament/Pages/DeploymentGuide.php.njk', {
            namespace: 'App\\Filament\\Pages',
        });
        fs.writeFileSync(path.join(pagesDir, 'DeploymentGuide.php'), phpOut);

        // 4. JANA BLADE VIEW (deployment-guide.blade.php)
        const bladeOut = renderTemplate('resources/views/filament/pages/deployment-guide.blade.php.njk', {
            app_db_name: appDbName,
        });
        fs.writeFileSync(path.join(viewsDir, 'deployment-guide.blade.php'), bladeOut);

        return { success: true };

    } catch (error) {
        console.error("Failed to generate Deployment Guide:", error);
        return { success: false, message: error.message };
    }
}

module.exports = { generateDeploymentGuidePage };
