const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toPluralPascalCase, readTemplate } = require('../utils');

/**
 * [HELPER] Menjana satu fail Create Page.
 * Digunakan oleh Generator Standard dan Custom Module.
 */
async function generateSingleCreatePage(tableName, tableData, fullSchema, basePath, templateContent, options = {}) {
    const { database: { relationships } } = fullSchema;

    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                        ? tableData.module_name 
                        : tableName;

    const standardModelName = toSingularPascalCase(nameSource);
    const standardFolder = toPluralPascalCase(nameSource);

    const modelNameSingular = options.modelName || standardModelName;
    const resourceFolder = options.resourceFolder || standardFolder;

    // --- LOGIC NAMING FIX ---
    // Custom Module: CreatePendingRegistrations.php
    let pageClassName = `Create${modelNameSingular}`;
    if (options.customPageName) {
        pageClassName = `Create${options.customPageName}`;
    }

    let createContent = templateContent;

    // Replacement Standard
    if (options.customPageName) {
    createContent = createContent.replace(/<<TABLE_NAME_SINGULAR>>/g, options.customPageName);    
    }else{
    createContent = createContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);    
    }
    
    createContent = createContent.replace(/<<TABLE_NAME_PLURAL>>/g, resourceFolder); 

    // Fix Class Name untuk Custom Module
    if (options.customPageName) {
        const oldClassDef = `class Create${modelNameSingular}`;
        const newClassDef = `class ${pageClassName}`;
        createContent = createContent.replace(new RegExp(oldClassDef, 'g'), newClassDef);
    }

    // ... (Logik lain kekal sama) ...
    if (tableData && tableData.column_grid_type === 'dynamic') {
        createContent = createContent.replace('<<GRIDCOLUMN_VAR>>', 'public int $gridColumns = 2;');
    } else {
        createContent = createContent.replace('<<GRIDCOLUMN_VAR>>', '');
    }

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

    createContent = createContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
    createContent = createContent.replace(/<<.*?>>/g, '');

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
    fs.mkdirSync(outputFolderPath, { recursive: true });

    // Guna pageClassName
    const fileName = `${pageClassName}.php`;
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

async function generateFilamentCreateCustomModules(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/PagesCreate.template');
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
                    
                    await generateSingleCreatePage(tableName, tableData, fullSchema, basePath, templateContent, {
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