const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toPluralPascalCase, toPluralCamelCase, readTemplate } = require('../utils');

/**
 * [HELPER] Menjana satu fail List Page.
 * Digunakan oleh Generator Standard dan Custom View.
 */
async function generateSingleListPage(tableName, tableData, fullSchema, basePath, templateContent, options = {}) {
    const { database: { relationships } } = fullSchema;

    // ========================================================================
    // LOGIK PENAMAAN BARU (MODULE NAME vs TABLE NAME)
    // ========================================================================
    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                        ? tableData.module_name 
                        : tableName;

    // Nama Model (Standard) - cth: StudentInfo (bukan Pelajar)
    const standardModelName = toSingularPascalCase(nameSource);
    
    // Nama Folder Standard - cth: StudentInfos
    const standardFolder = toPluralPascalCase(nameSource);

    // Tentukan Nama Model untuk Page ini (Biasanya sama dengan standardModelName)
    const modelNameSingular = options.modelName || standardModelName;
    
    // Tentukan Folder Resource (Namespace)
    // Jika Custom View: 'PendingRegistrations'
    // Jika Standard: 'StudentInfos'
    const resourceFolder = options.resourceFolder || standardFolder; 

    // Nama fail List Page: ListStudentInfos.php (Standard) atau ListPendingRegistrations.php (Custom)
    // Biasanya Filament menggunakan konvensyen 'List' + ResourcePluralName
    const listPageName = `List${resourceFolder}`;

    let listContent = templateContent;

    // Replacement Standard
    if (options.customPageName) {
    listContent = listContent.replace(/<<TABLE_NAME_SINGULAR>>/g, options.customPageName);    
    }else{
    listContent = listContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);    
    }
    
    listContent = listContent.replace(/<<TABLE_NAME_PLURAL>>/g, resourceFolder);

    listContent = listContent.replace('<<TABLE_VIEW_TITLE>>', tableData.table_view_title || resourceFolder);
    
    // --- LOGIK ASAL IFRAME (KEKAL 100%) ---
    // Nota: 'relationships' masih merujuk kepada table_name DB sebenar.
    const parentRelationForIframe = relationships.find(r => r.child_table_name === tableName && r.show_count_in_tv === 1);
    const needsIframeLogic = !!parentRelationForIframe;

    if (needsIframeLogic) {
        const foreignKey = parentRelationForIframe.fk_child_field; // Nama column DB sebenar

        const createActionCode = `CreateAction::make()
    ->when(
        session('is_in_iframe'),
        fn (CreateAction $action) => $action->url(fn (): string => static::getResource()::getUrl('create', [
                    '${foreignKey}' => request()->query('${foreignKey}')
                ]))
    )`;
        listContent = listContent.replace('<<CREATE_ACTION>>', createActionCode);
        
        listContent = listContent.replace('<<IMPORT_BUILDER>>', 'use Illuminate\\Database\\Eloquent\\Builder;');

        const filterQueryCode = `
    protected function getTableQuery(): Builder
    {
        $query = parent::getTableQuery();
        
        if ($fkValue = request()->query('${foreignKey}')) {
            $query->where('${foreignKey}', $fkValue);
        }
        return $query;
    }`;
        listContent = listContent.replace('<<FILTER_QUERY>>', filterQueryCode);
        
        const iframeSetupCode = `
    public function mount(): void
    {
        parent::mount();

        if (request()->has('iframe')) {
            session(['is_in_iframe' => true]);
            session(['foreignkey' => '${foreignKey}']);
        } else {
            session()->forget('is_in_iframe');
            session()->forget('foreignkey');
        }
    }
    
    public function getLayout(): string
    {
        if (session('is_in_iframe')) {
            return 'filament.layouts.custom-iframe-layout';
        }
        return parent::getLayout();
    }`;
        listContent = listContent.replace('<<IFRAME_SETUP>>', iframeSetupCode);

    } else {
        listContent = listContent.replace('<<CREATE_ACTION>>', 'CreateAction::make(),');
        listContent = listContent.replace('<<IMPORT_BUILDER>>', '');
        listContent = listContent.replace('<<FILTER_QUERY>>', '');
        listContent = listContent.replace('<<IFRAME_SETUP>>', '');
    }

    // --- LOGIK ASAL CSS VERTICAL ACTION (KEKAL 100%) ---
    const hasChildWithCount = relationships.some(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
    if (hasChildWithCount) {
        const cssCode = `
        FilamentView::registerRenderHook(
            'panels::body.end',
            fn (): string => <<<HTML
                <style>
                    td.fi-ta-cell > .fi-ta-actions {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start; 
                        gap: 0.5rem; 
                    }
                </style>
            HTML
        );`;
        listContent = listContent.replace('<<VERTICAL_ACTION_BUTTON_CSS>>', cssCode);
    } else {
        listContent = listContent.replace('<<VERTICAL_ACTION_BUTTON_CSS>>', '');
    }

    // --- LOGIK ASAL PRINT CSS (KEKAL 100%) ---
    if (tableData.allow_print_view === 1) {
        const printCssCode = `
        if ((bool) request()->query('print')) {
            FilamentView::registerRenderHook(
                'panels::body.end',
                fn (): string => <<<HTML
                    <style>
                        @media print {
                            body { visibility: hidden; }
                            .fi-ta-content-ctn, .fi-ta-content-ctn * { visibility: visible; }
                            .fi-ta-content-ctn { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; }
                            body { font-size: 12pt !important; background-color: #fff !important; }
                            .fi-ta-cell .fi-ta-actions { display: none !important; }
                        }
                    </style>
                    <script>
                        window.onload = () => {
                            window.print();
                            window.onafterprint = () => { window.close(); };
                        };
                    </script>
                HTML
            );
        }`;
        listContent = listContent.replace('<<PRINT_ACTION_CSS>>', printCssCode);
    } else {
        listContent = listContent.replace('<<PRINT_ACTION_CSS>>', '');
    }

    // Pembersihan Akhir
    listContent = listContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
    listContent = listContent.replace(/<<.*?>>/g, '');

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
    fs.mkdirSync(outputFolderPath, { recursive: true });

    // Nama Fail: ListStudentInfos.php
    const fileName = `${listPageName}.php`;
    const outputFilePath = path.join(outputFolderPath, fileName);
    fs.writeFileSync(outputFilePath, listContent);
    console.log(`List Page generated: ${outputFilePath}`);
}

// [UTAMA] Standard List Pages
async function generateFilamentListPages(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/PagesList.template');
        for (const tableName in tables) {
            if (tableName === 'users') continue;
            // Helper akan uruskan nama based on Module Name
            await generateSingleListPage(tableName, tables[tableName], fullSchema, basePath, templateContent);
        }
        return { success: true, message: 'Filament List Pages generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// [BARU] Custom View List Pages
async function generateFilamentListCustomViews(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/PagesList.template');
        let count = 0;

        for (const tableName in tables) {
            const tableData = tables[tableName];
            if (tableData.custom_views && tableData.custom_views.length > 0) {
                // Untuk Custom View, kita perlu nama Model asal (Module Name)
                // cth: StudentInfo
                const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                                    ? tableData.module_name 
                                    : tableName;
                const standardModelName = toSingularPascalCase(nameSource);

                for (const view of tableData.custom_views) {
                    
                    const viewNameClean = view.view_name.replace(/[^a-zA-Z0-9]/g, '');

                    // FOLDER: Plural
                    const viewSafeNamePlural = toPluralPascalCase(viewNameClean);
                    // FAIL: Singular
                    const viewSafeNameSingular = toSingularPascalCase(viewNameClean);
                    
                    // Panggil Helper
                    // resourceFolder = 'PendingRegistrations'
                    // modelName = 'StudentInfo'
                    await generateSingleListPage(tableName, tableData, fullSchema, basePath, templateContent, {
                        modelName: standardModelName,
                        resourceFolder: viewSafeNamePlural,
                        customPageName: viewSafeNameSingular                        
                    });
                    count++;
                }
            }
        }
        return { success: true, message: `${count} Custom View List Pages generated.` };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    generateFilamentListPages,
    generateFilamentListCustomViews,
    generateSingleListPage
};