const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toPluralPascalCase, readTemplate } = require('../utils');

/**
 * [HELPER] Menjana satu fail Edit Page.
 * Digunakan oleh Generator Standard dan Custom Module.
 */
async function generateSingleEditPage(tableName, tableData, fullSchema, basePath, templateContent, options = {}) {
    const { database: { relationships } } = fullSchema;

    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                        ? tableData.module_name 
                        : tableName;

    const standardModelName = toSingularPascalCase(nameSource);
    const standardFolder = toPluralPascalCase(nameSource);

    const modelNameSingular = options.modelName || standardModelName;
    const resourceFolder = options.resourceFolder || standardFolder;

    // --- LOGIC NAMING FIX ---
    // Custom Module: EditPendingRegistrations.php
    // Standard: EditStudentInfo.php
    let pageClassName = `Edit${modelNameSingular}`;
    if (options.customPageName) {
        pageClassName = `Edit${options.customPageName}`;
    }

    let editContent = templateContent;

    // Standard Replacements
    if (options.customPageName) {
    editContent = editContent.replace(/<<TABLE_NAME_SINGULAR>>/g, options.customPageName);    
    }else{
    editContent = editContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);    
    }
    
    editContent = editContent.replace(/<<TABLE_NAME_PLURAL>>/g, resourceFolder);
    
    // Fix Class Name untuk Custom Module
    if (options.customPageName) {
        // Regex untuk menggantikan nama class yang dijana oleh placeholder <<TABLE_NAME_SINGULAR>>
        // Template: class Edit<<TABLE_NAME_SINGULAR>> extends EditRecord
        // Selepas replace atas: class EditStudentInfo extends EditRecord
        const oldClassDef = `class Edit${modelNameSingular}`;
        const newClassDef = `class ${pageClassName}`;
        editContent = editContent.replace(new RegExp(oldClassDef, 'g'), newClassDef);
    }

    // ... (Logik Primary Key, Unique, etc. kekal sama) ...
    const primaryKeyField = Object.values(tableData.fields).find(f => f.primary_key === 1);
    editContent = editContent.replace(/<<PRIMARY_KEY>>/g, primaryKeyField ? primaryKeyField.field_name : 'id');

    const uniqueFields = Object.values(tableData.fields).filter(f => f.unique === 1);
    if (uniqueFields.length > 0) {
        const uniqueEmptyLines = uniqueFields.map(f => `        $data['${f.field_name}'] = '';`).join('\n');
        editContent = editContent.replace('<<UNIQUE_EMPTY>>', uniqueEmptyLines);
    } else {
        editContent = editContent.replace('<<UNIQUE_EMPTY>>', '');
    }

    const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];
    const firstStringField = Object.values(tableData.fields).find(f => stringTypes.includes(f.data_type.toUpperCase()));
    editContent = editContent.replace('<<FIRST_STRING_FIELD>>', firstStringField ? firstStringField.field_name : '');
    
    if (tableData && tableData.column_grid_type === 'dynamic') {
        editContent = editContent.replace('<<GRIDCOLUMN_VAR>>', '    public int $gridColumns = 2;');
    } else {
        editContent = editContent.replace('<<GRIDCOLUMN_VAR>>', '');
    }
    
    const isParentTable = relationships.some(r => r.parent_table_name === tableName);
    if(isParentTable) {
        const iframeParentCode = `
    public function mount(string|int $record): void
    {
        parent::mount($record);
        if (request()->has('iframe')) {
            session(['is_in_iframe' => true]);
        } else {
            session()->forget('is_in_iframe');
        }
    }
	
    public function getLayout(): string
    {
        if (request()->has('iframe')) {
            return 'filament.layouts.custom-iframe-layout';
        }
        return parent::getLayout();
    }`;
        editContent = editContent.replace('<<IFRAME_PARENT_SETUP>>', iframeParentCode);
    } else {
        editContent = editContent.replace('<<IFRAME_PARENT_SETUP>>', '');
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
        editContent = editContent.replace('<<IFRAME_CHILD_LAYOUT>>', iframeLayoutCode);
    } else {
        editContent = editContent.replace('<<IFRAME_CHILD_LAYOUT>>', '');
    }

    const isChildTable = relationships.some(r => r.child_table_name === tableName);
    if (isChildTable) {
        editContent = editContent.replace('<<IMPORT_CLOSE_IFRAME>>', 'use Filament\\Support\\Facades\\FilamentView;\nuse Illuminate\\Contracts\\View\\View;');
        const refreshIframeCode = `
    public function render(): View
    {
        FilamentView::registerRenderHook(
            'panels::body.end',
            fn (): string => <<<HTML
                <script>
                    document.addEventListener('click', function (event) {
                        if (event.target.closest('.fi-modal-close-btn')) {
                            setTimeout(() => {
                                window.parent.location.reload();
                            }, 100);
                        }
                    });
                </script>
            HTML
        );
        return parent::render();
    }`;
        editContent = editContent.replace('<<REFRESH_CLOSE_IFRAME>>', refreshIframeCode);
    } else {
        editContent = editContent.replace('<<IMPORT_CLOSE_IFRAME>>', '');
        editContent = editContent.replace('<<REFRESH_CLOSE_IFRAME>>', '');
    }

    editContent = editContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
    editContent = editContent.replace(/<<.*?>>/g, '');

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
    fs.mkdirSync(outputFolderPath, { recursive: true });
    
    // Guna pageClassName
    const fileName = `${pageClassName}.php`;
    const outputFilePath = path.join(outputFolderPath, fileName);
    
    fs.writeFileSync(outputFilePath, editContent);
    console.log(`Edit Page generated: ${outputFilePath}`);
}

// [UTAMA] Standard Edit Pages
async function generateFilamentEditPages(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/PagesEdit.template');
        for (const tableName in tables) {
            if (tableName === 'users') continue;
            await generateSingleEditPage(tableName, tables[tableName], fullSchema, basePath, templateContent);
        }
        return { success: true, message: 'Filament Edit Pages generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function generateFilamentEditCustomModules(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/PagesEdit.template');
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
                    
                    await generateSingleEditPage(tableName, tableData, fullSchema, basePath, templateContent, {
                        modelName: standardModelName,
                        resourceFolder: viewSafeNamePlural, // Simpan dalam folder Plural
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