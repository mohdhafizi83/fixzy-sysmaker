const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toPluralPascalCase } = require('../utils');
const { renderTemplate } = require('../render/engine');

const TEMPLATE = 'app/Filament/Resources/PagesCreate.php.njk';

/**
 * [HELPER] Menjana satu fail Create Page.
 * Digunakan oleh Generator Standard dan Custom Module.
 */
async function generateSingleCreatePage(tableName, tableData, fullSchema, basePath, options = {}) {
    const { database: { relationships } } = fullSchema;

    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                        ? tableData.module_name 
                        : tableName;

    const standardModelName = toSingularPascalCase(nameSource);
    const standardFolder = toPluralPascalCase(nameSource);

    const modelNameSingular = options.modelName || standardModelName;
    const resourceFolder = options.resourceFolder || standardFolder;

    // --- LOGIC NAMING FIX ---
    let pageClassName = `Create${modelNameSingular}`;
    if (options.customPageName) {
        pageClassName = `Create${options.customPageName}`;
    }

    const isChildInIframeContext = relationships.some(r => 
        r.child_table_name === tableName && r.show_count_in_tv === 1
    );

    const createContent = renderTemplate(TEMPLATE, {
        page_class_base: options.customPageName || modelNameSingular,
        resource_folder: resourceFolder,
        dynamic_grid: !!(tableData && tableData.column_grid_type === 'dynamic'),
        iframe_layout: isChildInIframeContext,
    });

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
    fs.mkdirSync(outputFolderPath, { recursive: true });

    const fileName = `${pageClassName}.php`;
    const outputFilePath = path.join(outputFolderPath, fileName);
    
    fs.writeFileSync(outputFilePath, createContent);
    console.log(`Create Page generated: ${outputFilePath}`);
}

// [UTAMA] Standard Create Pages
async function generateFilamentCreatePages(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        for (const tableName in tables) {
            if (tableName === 'users') continue;
            await generateSingleCreatePage(tableName, tables[tableName], fullSchema, basePath);
        }
        return { success: true, message: 'Filament Create Pages generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function generateFilamentCreateCustomModules(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        let count = 0;

        for (const tableName in tables) {
            const tableData = tables[tableName];
            if (tableData.custom_modules && tableData.custom_modules.length > 0) {
                
                const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                                    ? tableData.module_name 
                                    : tableName;
                const standardModelName = toSingularPascalCase(nameSource);

                for (const view of tableData.custom_modules) {
                    const viewNameClean = view.module_name.replace(/[^a-zA-Z0-9]/g, '');

                    // FOLDER: Plural
                    const viewSafeNamePlural = toPluralPascalCase(viewNameClean);
                    // FAIL: Singular
                    const viewSafeNameSingular = toSingularPascalCase(viewNameClean);
                    
                    await generateSingleCreatePage(tableName, tableData, fullSchema, basePath, {
                        modelName: standardModelName,
                        resourceFolder: viewSafeNamePlural, // Simpan dalam folder Plural
                        customPageName: viewSafeNameSingular // Nama Class CreateSingular
                    });
                    count++;
                }
            }
        }
        return { success: true, message: `${count} Custom Module Create Pages generated.` };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    generateFilamentCreatePages,
    generateFilamentCreateCustomModules,
    generateSingleCreatePage
};
