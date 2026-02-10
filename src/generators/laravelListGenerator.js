const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toPluralPascalCase, toPluralCamelCase, readTemplate } = require('../utils');

/**
 * [HELPER] Menjana satu fail List Page.
 * Digunakan oleh Generator Standard dan Custom View.
 */
async function generateSingleListPage(tableName, tableData, fullSchema, basePath, templateContent, options = {}) {
    const { database: { relationships } } = fullSchema;

    const modelNameSingular = options.modelName || toSingularPascalCase(tableName);
    // Jika Custom View, 'resourceFolder' adalah nama view (cth: PendingOrders). 
    // Jika standard, ia adalah nama plural table (cth: Orders).
    const modelNamePlural = options.resourceFolder || toPluralPascalCase(tableName); 

    let listContent = templateContent;

    listContent = listContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);
    listContent = listContent.replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);

    listContent = listContent.replace('<<TABLE_VIEW_TITLE>>', tableData.table_view_title || modelNamePlural);
    
    // --- LOGIK ASAL IFRAME (KEKAL 100%) ---
    const parentRelationForIframe = relationships.find(r => r.child_table_name === tableName && r.show_count_in_tv === 1);
    const needsIframeLogic = !!parentRelationForIframe;

    if (needsIframeLogic) {
        const foreignKey = parentRelationForIframe.fk_child_field;

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

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', modelNamePlural, 'Pages');
    fs.mkdirSync(outputFolderPath, { recursive: true });

    const fileName = `List${modelNamePlural}.php`;
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
                for (const view of tableData.custom_views) {
                    
                    const viewSafeName = toPluralPascalCase(view.view_name.replace(/[^a-zA-Z0-9]/g, ''));
                    
                    // Panggil Helper
                    // Option 'resourceFolder' akan memaksa helper simpan dalam folder Custom View (cth: PendingOrders/Pages)
                    // Nama Model kekal ikut table asal (Order)
                    await generateSingleListPage(tableName, tableData, fullSchema, basePath, templateContent, {
                        modelName: toSingularPascalCase(tableName),
                        resourceFolder: viewSafeName 
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
    generateFilamentListCustomViews, // Function Baru
    generateSingleListPage
};