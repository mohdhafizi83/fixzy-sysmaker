const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toPluralPascalCase, readTemplate } = require('../utils');

/**
 * [HELPER] Menjana satu fail Create Page.
 * Digunakan oleh Generator Standard dan Custom View.
 */
async function generateSingleCreatePage(tableName, tableData, fullSchema, basePath, templateContent, options = {}) {
    const { database: { relationships } } = fullSchema;

    const modelNameSingular = options.modelName || toSingularPascalCase(tableName);
    // Untuk Custom View, resourceFolder ialah nama view (cth: PendingOrders).
    // Untuk Standard, ia adalah nama plural table (cth: Orders).
    const resourceFolder = options.resourceFolder || toPluralPascalCase(tableName);

    let createContent = templateContent;

    // Replacement Standard
    createContent = createContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);
    createContent = createContent.replace(/<<TABLE_NAME_PLURAL>>/g, resourceFolder); // Penting untuk Namespace

    // --- LOGIK ASAL GRID COLUMNS (KEKAL 100%) ---
    if (tableData && tableData.column_grid_type === 'dynamic') {
        createContent = createContent.replace('<<GRIDCOLUMN_VAR>>', 'public int $gridColumns = 2;');
    } else {
        createContent = createContent.replace('<<GRIDCOLUMN_VAR>>', '');
    }

    // --- LOGIK ASAL IFRAME LAYOUT (KEKAL 100%) ---
    // Menyemak jika jadual ini adalah anak kepada jadual lain yang memaparkan count (konteks iframe)
    const isChildInIframeContext = relationships.some(r => 
        r.child_table_name === tableName && r.show_count_in_tv === 1
    );

    if (isChildInIframeContext) {
        const iframeLayoutCode = `
    public function getLayout(): string
    {
        if (session('is_in_iframe')) {
            return 'filament.layouts.custom-iframe-layout';
        }
        
        return parent::getLayout();
    }
`;
        createContent = createContent.replace('<<IFRAME_LAYOUT>>', iframeLayoutCode);
    } else {
        createContent = createContent.replace('<<IFRAME_LAYOUT>>', '');
    }

    // Pembersihan Akhir
    createContent = createContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
    createContent = createContent.replace(/<<.*?>>/g, '');

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
    fs.mkdirSync(outputFolderPath, { recursive: true });

    // Nama Fail: CreateOrder.php (Kekal standard walaupun dalam folder Custom View)
    const fileName = `Create${modelNameSingular}.php`;
    const outputFilePath = path.join(outputFolderPath, fileName);
    
    fs.writeFileSync(outputFilePath, createContent);
    console.log(`Create Page generated: ${outputFilePath}`);
}

// [UTAMA] Standard Create Pages
async function generateFilamentCreatePages(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/PagesCreate.template');
        for (const tableName in tables) {
            if (tableName === 'users') continue;
            await generateSingleCreatePage(tableName, tables[tableName], fullSchema, basePath, templateContent);
        }
        return { success: true, message: 'Filament Create Pages generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// [BARU] Custom View Create Pages
async function generateFilamentCreateCustomViews(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/PagesCreate.template');
        let count = 0;

        for (const tableName in tables) {
            const tableData = tables[tableName];
            if (tableData.custom_views && tableData.custom_views.length > 0) {
                for (const view of tableData.custom_views) {
                    const viewSafeName = toPluralPascalCase(view.view_name.replace(/[^a-zA-Z0-9]/g, ''));
                    
                    await generateSingleCreatePage(tableName, tableData, fullSchema, basePath, templateContent, {
                        modelName: toSingularPascalCase(tableName),
                        resourceFolder: viewSafeName
                    });
                    count++;
                }
            }
        }
        return { success: true, message: `${count} Custom View Create Pages generated.` };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    generateFilamentCreatePages,
    generateFilamentCreateCustomViews, // Function Baru
    generateSingleCreatePage
};