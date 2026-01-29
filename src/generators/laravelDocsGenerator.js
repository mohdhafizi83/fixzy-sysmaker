const fs = require('fs');
const path = require('path');

const { 
    readTemplate
} = require('../utils');

async function generateDeploymentGuidePage(fullSchema, basePath) {
    try {
        console.log("Generating Deployment Guide from Templates...");

        // 1. Tentukan Laluan Folder Output
        const pagesDir = path.join(basePath, 'app', 'Filament', 'Pages');
        const viewsDir = path.join(basePath, 'resources', 'views', 'filament', 'pages');

        if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });
        if (!fs.existsSync(viewsDir)) fs.mkdirSync(viewsDir, { recursive: true });

        // 2. Data untuk penggantian (Replacements)
        // Kita boleh masukkan nama projek ke dalam panduan jika mahu
        const appDbName = fullSchema.project.app_title 
            ? fullSchema.project.app_title.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() 
            : 'nama_db_anda';

        // ============================================================
        // 3. JANA PHP CLASS (DeploymentGuide.php)
        // ============================================================
        let phpTemplate = readTemplate('app/Filament/Pages/DeploymentGuide.template');
        
        // Lakukan penggantian placeholder
        phpTemplate = phpTemplate.replace(/<<NAMESPACE>>/g, 'App\\Filament\\Pages');
        
        fs.writeFileSync(path.join(pagesDir, 'DeploymentGuide.php'), phpTemplate);

        // ============================================================
        // 4. JANA BLADE VIEW (deployment-guide.blade.php)
        // ============================================================
        let bladeTemplate = readTemplate('resources/views/filament/pages/deployment-guide.blade.template');
        
        // Gantikan placeholder nama DB dalam panduan
        bladeTemplate = bladeTemplate.replace(/<<APP_DB_NAME>>/g, appDbName);

        fs.writeFileSync(path.join(viewsDir, 'deployment-guide.blade.php'), bladeTemplate);

        return { success: true };

    } catch (error) {
        console.error("Failed to generate Deployment Guide:", error);
        return { success: false, message: error.message };
    }
}

module.exports = { generateDeploymentGuidePage };