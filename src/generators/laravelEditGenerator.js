// Filament Edit page generator (Fixzy SysMaker).
// Renders app/Filament/Resources/<Folder>/Pages/Edit<Model>.php for
// standard tables and custom modules from PagesEdit.php.njk.
const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toPluralPascalCase } = require('../utils');
const { renderTemplate } = require('../render/engine');

const TEMPLATE = 'app/Filament/Resources/PagesEdit.php.njk';

/**
 * [HELPER] Menjana satu fail Edit Page.
 * Digunakan oleh Generator Standard dan Custom Module.
 */
async function generateSingleEditPage(tableName, tableData, fullSchema, basePath, options = {}) {
    const { database: { relationships } } = fullSchema;

    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                        ? tableData.module_name 
                        : tableName;

    const standardModelName = toSingularPascalCase(nameSource);
    const standardFolder = toPluralPascalCase(nameSource);

    const modelNameSingular = options.modelName || standardModelName;
    const resourceFolder = options.resourceFolder || standardFolder;

    // --- LOGIC NAMING FIX ---
    let pageClassName = `Edit${modelNameSingular}`;
    if (options.customPageName) {
        pageClassName = `Edit${options.customPageName}`;
    }

    const primaryKeyField = Object.values(tableData.fields).find(f => f.primary_key === 1);

    const uniqueFields = Object.values(tableData.fields).filter(f => f.unique === 1);
    const uniqueEmptyLines = uniqueFields.map(f => `        $data['${f.field_name}'] = '';`).join('\n');

    const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];
    const firstStringField = Object.values(tableData.fields).find(f => stringTypes.includes(f.data_type.toUpperCase()));

    const isParentTable = relationships.some(r => r.parent_table_name === tableName);
    const isChildInIframeContext = relationships.some(r => 
        r.child_table_name === tableName && r.show_count_in_tv === 1
    );
    const isChildTable = relationships.some(r => r.child_table_name === tableName);

    const editContent = renderTemplate(TEMPLATE, {
        page_class_base: options.customPageName || modelNameSingular,
        resource_folder: resourceFolder,
        primary_key: primaryKeyField ? primaryKeyField.field_name : 'id',
        unique_empty: uniqueEmptyLines,
        first_string_field: firstStringField ? firstStringField.field_name : '',
        dynamic_grid: !!(tableData && tableData.column_grid_type === 'dynamic'),
        iframe_parent: isParentTable,
        iframe_child: isChildTable,
        iframe_child_layout: isChildInIframeContext,
    });

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
    fs.mkdirSync(outputFolderPath, { recursive: true });
    
    const fileName = `${pageClassName}.php`;
    const outputFilePath = path.join(outputFolderPath, fileName);
    
    fs.writeFileSync(outputFilePath, editContent);
    console.log(`Edit Page generated: ${outputFilePath}`);
}

// [UTAMA] Standard Edit Pages
/**
 * Generate Edit pages for every non-users base table.
 * @param {object} fullSchema assembled project schema
 * @param {string} basePath generated app root
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function generateFilamentEditPages(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        for (const tableName in tables) {
            if (tableName === 'users') continue;
            await generateSingleEditPage(tableName, tables[tableName], fullSchema, basePath);
        }
        return { success: true, message: 'Filament Edit Pages generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Generate Edit pages for every custom module (one per module view).
 * @param {object} fullSchema assembled project schema
 * @param {string} basePath generated app root
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function generateFilamentEditCustomModules(fullSchema, basePath) {
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
                    
                    await generateSingleEditPage(tableName, tableData, fullSchema, basePath, {
                        modelName: standardModelName,
                        resourceFolder: viewSafeNamePlural, // Save in the Plural folder
                        customPageName: viewSafeNameSingular // Nama Class EditSingular
                    });
                    count++;
                }
            }
        }
        return { success: true, message: `${count} Custom Module Edit Pages generated.` };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    generateFilamentEditPages,
    generateFilamentEditCustomModules,
    generateSingleEditPage
};
