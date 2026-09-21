const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toPluralPascalCase } = require('../utils');
const { renderTemplate } = require('../render/engine');

const TEMPLATE = 'app/Filament/Resources/PagesList.php.njk';

/**
 * [HELPER] Menjana satu fail List Page.
 * Digunakan oleh Generator Standard dan Custom Module.
 */
async function generateSingleListPage(tableName, tableData, fullSchema, basePath, options = {}) {
    const { database: { relationships } } = fullSchema;

    // ========================================================================
    // LOGIK PENAMAAN (MODULE NAME vs TABLE NAME)
    // ========================================================================
    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                        ? tableData.module_name 
                        : tableName;

    const standardModelName = toSingularPascalCase(nameSource);
    const standardFolder = toPluralPascalCase(nameSource);

    const modelNameSingular = options.modelName || standardModelName;
    const resourceFolder = options.resourceFolder || standardFolder;

    // Nama fail List Page: ListStudentInfos.php (Standard) / ListPendingRegistrations.php (Custom)
    const listPageName = `List${resourceFolder}`;

    // Use moduleTitle when present (for Custom Module), otherwise the original table title
    const pageTitle = options.moduleTitle || tableData.table_view_title || resourceFolder;

    // --- LOGIK ASAL IFRAME ---
    const parentRelationForIframe = relationships.find(r => r.child_table_name === tableName && r.show_count_in_tv === 1);
    const needsIframeLogic = !!parentRelationForIframe;
    const foreignKey = needsIframeLogic ? parentRelationForIframe.fk_child_field : '';

    // --- LOGIK ASAL CSS VERTICAL ACTION ---
    const hasChildWithCount = relationships.some(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);

    const listContent = renderTemplate(TEMPLATE, {
        page_class_base: options.customPageName || modelNameSingular,
        resource_folder: resourceFolder,
        page_title: pageTitle,
        iframe_logic: needsIframeLogic,
        foreign_key: foreignKey,
        vertical_css: hasChildWithCount,
        print_css: tableData.allow_print_view === 1,
    });

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
    fs.mkdirSync(outputFolderPath, { recursive: true });

    const fileName = `${listPageName}.php`;
    const outputFilePath = path.join(outputFolderPath, fileName);
    fs.writeFileSync(outputFilePath, listContent);
    console.log(`List Page generated: ${outputFilePath}`);
}

// [UTAMA] Standard List Pages
async function generateFilamentListPages(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        for (const tableName in tables) {
            if (tableName === 'users') continue;
            await generateSingleListPage(tableName, tables[tableName], fullSchema, basePath);
        }
        return { success: true, message: 'Filament List Pages generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Custom Module List Pages
async function generateFilamentListCustomModules(fullSchema, basePath) {
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
                    
                    await generateSingleListPage(tableName, tableData, fullSchema, basePath, {
                        modelName: standardModelName,
                        resourceFolder: viewSafeNamePlural,
                        customPageName: viewSafeNameSingular,
                        moduleTitle: view.module_name                        
                    });
                    count++;
                }
            }
        }
        return { success: true, message: `${count} Custom Module List Pages generated.` };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    generateFilamentListPages,
    generateFilamentListCustomModules,
    generateSingleListPage
};
