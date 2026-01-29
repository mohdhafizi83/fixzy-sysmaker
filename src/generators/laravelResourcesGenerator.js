const fs = require('fs');
const path = require('path');

// IMPORT FUNGSI BANTUAN DARI UTILS
const { 
    toSingularPascalCase,
    toPluralPascalCase,
    toPluralCamelCase,
    toFlatCase,
    readTemplate
} = require('../utils');

/**
 * Menjana fail List Page Laravel Filament untuk setiap resource.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentListPages(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;

        const templateContent = readTemplate('app/Filament/Resources/PagesList.template');

        for (const tableName in tables) {
            if (tableName === 'users') {
                continue; 
            }

            const tableData = tables[tableName];
            let listContent = templateContent;

            const modelNameSingular = toSingularPascalCase(tableName);
            const modelNamePlural = toPluralPascalCase(tableName);
            listContent = listContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);
            listContent = listContent.replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);

            listContent = listContent.replace('<<TABLE_VIEW_TITLE>>', tableData.table_view_title || modelNamePlural);
            
            // Logik yang betul: cari hubungan di mana jadual ini adalah anak DAN parent mempunyai tetapan 'show_count_in_tv'
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
                // Jika bukan dalam konteks iframe, guna CreateAction biasa
                listContent = listContent.replace('<<CREATE_ACTION>>', 'CreateAction::make(),');
            }

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
            }

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
            }

            listContent = listContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            listContent = listContent.replace(/<<.*?>>/g, '');

            const resourceFolder = modelNamePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
            fs.mkdirSync(outputFolderPath, { recursive: true });

            const outputFilePath = path.join(outputFolderPath, `List${modelNamePlural}.php`);
            fs.writeFileSync(outputFilePath, listContent);
            console.log(`List Page generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament List Pages generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament List Pages:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Menjana fail Create Page Laravel Filament untuk setiap resource.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentCreatePages(fullSchema, basePath) {
    try {
        const { database: { table: tables, relationships } } = fullSchema;

        const templateContent = readTemplate('app/Filament/Resources/PagesCreate.template');

        for (const tableName in tables) {
            if (tableName === 'users') {
                continue; // Langkau jadual 'users'
            }

            const tableData = tables[tableName]; // Dapatkan data untuk jadual semasa
            let createContent = templateContent;

            const modelNameSingular = toSingularPascalCase(tableName);
            createContent = createContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);

            const modelNamePlural = toPluralPascalCase(tableName);
            createContent = createContent.replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);
            
            // ▼▼▼ PENAMBAHBAIKAN UNTUK GRID COLUMNS BERMULA DI SINI ▼▼▼
            if (tableData && tableData.column_grid_type === 'dynamic') {
                createContent = createContent.replace('<<GRIDCOLUMN_VAR>>', 'public int $gridColumns = 2;');
            }
            // ▲▲▲ PENAMBAHBAIKAN TAMAT ▲▲▲

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
            }

            // Bersihkan placeholder yang tidak digunakan dan baris kosong
            createContent = createContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            createContent = createContent.replace(/<<.*?>>/g, '');

            const resourceFolder = modelNamePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
            fs.mkdirSync(outputFolderPath, { recursive: true });

            const outputFilePath = path.join(outputFolderPath, `Create${modelNameSingular}.php`);
            fs.writeFileSync(outputFilePath, createContent);
            console.log(`Create Page generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Create Pages generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Create Pages:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Menjana fail Edit Page Laravel Filament untuk setiap resource.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentEditPages(fullSchema, basePath) {
    try {
        const { database: { table: tables, relationships } } = fullSchema;

        const templateContent = readTemplate('app/Filament/Resources/PagesEdit.template');

        for (const tableName in tables) {
            if (tableName === 'users') {
                continue;
            }
            const tableData = tables[tableName];
            let editContent = templateContent;

            const modelNameSingular = toSingularPascalCase(tableName);
            editContent = editContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);

            const modelNamePlural = toPluralPascalCase(tableName);
            editContent = editContent.replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);
            
            const primaryKeyField = Object.values(tableData.fields).find(f => f.primary_key === 1);
            editContent = editContent.replace(/<<PRIMARY_KEY>>/g, primaryKeyField ? primaryKeyField.field_name : 'id');

            const uniqueFields = Object.values(tableData.fields).filter(f => f.unique === 1);
            if (uniqueFields.length > 0) {
                const uniqueEmptyLines = uniqueFields.map(f => `        $data['${f.field_name}'] = '';`).join('\n');
                editContent = editContent.replace('<<UNIQUE_EMPTY>>', uniqueEmptyLines);
            }

            const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];
            const firstStringField = Object.values(tableData.fields).find(f => stringTypes.includes(f.data_type.toUpperCase()));
            editContent = editContent.replace('<<FIRST_STRING_FIELD>>', firstStringField ? firstStringField.field_name : '');
            
            // ▼▼▼ PENAMBAHBAIKAN UNTUK GRID COLUMNS BERMULA DI SINI ▼▼▼
            if (tableData && tableData.column_grid_type === 'dynamic') {
                editContent = editContent.replace('<<GRIDCOLUMN_VAR>>', '    public int $gridColumns = 2;');
            }
            // ▲▲▲ PENAMBAHBAIKAN TAMAT ▲▲▲
            
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
            }

            editContent = editContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            editContent = editContent.replace(/<<.*?>>/g, '');

            const resourceFolder = modelNamePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
            fs.mkdirSync(outputFolderPath, { recursive: true });
            
            const outputFilePath = path.join(outputFolderPath, `Edit${modelNameSingular}.php`);
            fs.writeFileSync(outputFilePath, editContent);
            console.log(`Edit Page generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Edit Pages generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Edit Pages:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Menjana fail Resource Laravel Filament untuk setiap jadual.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
// FIND AND REPLACE THIS ENTIRE FUNCTION IN: main.js

async function generateFilamentResources(fullSchema, basePath) {
    try {
        const projectSettings = fullSchema.project;
        const tables = fullSchema.database.table;
        const relationships = fullSchema.database.relationships;
        const unifiedMenu = fullSchema.database.unified_menu;

        const templateContent = readTemplate('app/Filament/Resources/Resource.template');

        for (const tableName in tables) {
            if (tableName === 'users') {
                continue; 
            }

            const tableData = tables[tableName];
            let resourceContent = templateContent;

            let menuItem = null;
            let menuGroup = null;
            for (const topLevelItem of unifiedMenu) {
                if (topLevelItem.type === 'group') {
                    const foundItem = topLevelItem.items.find(item => item.table_id === tableData.table_id);
                    if (foundItem) {
                        menuItem = foundItem;
                        menuGroup = topLevelItem;
                        break;
                    }
                } else if (topLevelItem.table_id === tableData.table_id) {
                    menuItem = topLevelItem;
                    break;
                }
            }

            const modelName = toSingularPascalCase(tableName);
            const modelNamePlural = toPluralPascalCase(tableName);
            resourceContent = resourceContent.replace(/<<MODEL_NAME>>/g, modelName);
            resourceContent = resourceContent.replace(/<<MODEL_NAME_PLURAL>>/g, modelNamePlural);
            
            const childrenWithCount = relationships.filter(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
            if (childrenWithCount.length > 0) {
                resourceContent = resourceContent.replace('<<IMPORT_SHOW_COUNT_IN_TV>>', 'use Illuminate\\Database\\Eloquent\\Builder;');
                const childPluralCamelNames = childrenWithCount.map(r => `'${toPluralCamelCase(r.child_table_name)}'`).join(', ');
                const withCountFunction = `
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCount([${childPluralCamelNames}]);
    }`;
                resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', withCountFunction);
            }

            if (tableData.allow_print_view === 1) {
                resourceContent = resourceContent.replace('<<IMPORT_PRINTACTION>>', 'use Filament\\Actions\\Action;\nuse App\\Filament\\Actions\\PrintAction;');
                const printAction = `Action::make('print')
                    ->label('Print')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => request()->fullUrlWithQuery(['print' => 1]))
                    ->openUrlInNewTab(),`;
                resourceContent = resourceContent.replace('<<PRINT_ACTION>>', printAction);
            }

            if (tableData.allow_csv_export === 1) {
                const importExport = `use App\\Filament\\Exports\\${modelName}Exporter;\nuse Filament\\Actions\\ExportAction;`;
                const exportAction = `ExportAction::make()->exporter(${modelName}Exporter::class)
                ->enableVisibleTableColumnsByDefault(),`;
                resourceContent = resourceContent.replace('<<IMPORT_EXPORTDATA>>', importExport);
                resourceContent = resourceContent.replace('<<EXPORT_ACTION>>', exportAction);
            }

            if (tableData.allow_csv_import === 1) {
                const importImport = `use App\\Filament\\Imports\\${modelName}Importer;\nuse Filament\\Actions\\ImportAction;`;
                const importAction = `ImportAction::make()->importer(${modelName}Importer::class),`;
                resourceContent = resourceContent.replace('<<IMPORT_IMPORTDATA>>', importImport);
                resourceContent = resourceContent.replace('<<IMPORT_ACTION>>', importAction);
            }
            
            // ▼▼▼ PERUBAHAN UTAMA DI SINI ▼▼▼
            // Kini ia hanya akan mengambil hubungan 'one-to-many' untuk Relation Manager
            const childrenForRelationManager = relationships.filter(r => 
                r.parent_table_name === tableName && 
                r.show_tab === 1 &&
                r.relationship_type !== 'one-to-one' // <-- SYARAT BAHARU DITAMBAH
            );

            if (childrenForRelationManager.length > 0) {
                const importManagers = childrenForRelationManager.map(r => `use App\\Filament\\Resources\\${modelNamePlural}\\RelationManagers\\${toSingularPascalCase(r.child_table_name)}RelationManager;`).join('\n');
                const relationManagers = childrenForRelationManager.map(r => `            ${toSingularPascalCase(r.child_table_name)}RelationManager::class,`).join('\n');
                resourceContent = resourceContent.replace('<<IMPORT_RELATIONMANAGERS>>', importManagers);
                resourceContent = resourceContent.replace('<<RELATION_RELATIONMANAGERS>>', relationManagers);
            }
            // ▲▲▲ TAMAT PERUBAHAN ▲▲▲

            if (menuItem) {
                if (menuGroup) { 
                    const groupFunction = `
    public static function getNavigationGroup(): string
    {
        return '${menuGroup.name}';
    }`;
                    const sortFunction = `
    public static function getNavigationSort(): int
    {
        return ${menuItem.item_order};
    }`;
                    resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONGROUP>>', groupFunction);
                    resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONSORT>>', sortFunction);
                } else { 
                    const sortProperty = `protected static ?int $navigationSort = ${menuItem.item_order};`;
                    resourceContent = resourceContent.replace('<<SHORTCUT_MENU_ORDER>>', sortProperty);
                }
            }

            if (projectSettings.module_log_audit === 1) {
                const auditRelation = `
        if (auth()->check() && auth()->user()->can('view_any_audit')) {
            $relations[] = AuditsRelationManager::class;
        }`;
                resourceContent = resourceContent.replace('<<RELATIONS_AUDIT>>', auditRelation);
            }

            resourceContent = resourceContent.replace('<<MODEL_NAME_FLATCASE>>', toFlatCase(tableName));
            if (menuItem) {
                resourceContent = resourceContent.replace('<<MENU_NAME>>', menuItem.item_label);
            }

// Bersihkan placeholder yang tidak digunakan dan baris kosong yang terhasil
            resourceContent = resourceContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, ''); // Buang placeholder pada baris sendiri
            resourceContent = resourceContent.replace(/<<.*?>>/g, ''); // Buang placeholder dalam baris (inline)

            const resourceFolder = toPluralPascalCase(tableName); // Nama folder kekal plural
            const resourceClassName = `${modelName}Resource`;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder);
            fs.mkdirSync(outputFolderPath, { recursive: true });
            
            const outputFilePath = path.join(outputFolderPath, `${resourceClassName}.php`);
            fs.writeFileSync(outputFilePath, resourceContent);
            console.log(`Resource generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Resources generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Resources:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Menjana fail RelationManager Laravel Filament untuk setiap hubungan one-to-many.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentRelationManagers(fullSchema, basePath) {
    try {
        const { database: { relationships } } = fullSchema;

        const templateContent = readTemplate('app/Filament/Resources/RelationManagers.template');

        // Loop melalui setiap hubungan yang wujud
        for (const rel of relationships) {
            // Langkau jika ia adalah 'one-to-one' atau melibatkan jadual 'users'
            if (rel.relationship_type === 'one-to-one' || rel.parent_table_name === 'users' || rel.child_table_name === 'users') {
                continue;
            }

            let managerContent = templateContent;

            // Sediakan semua variasi nama yang diperlukan
            const parentTablePlural = toPluralPascalCase(rel.parent_table_name);
            const childTablePlural = toPluralPascalCase(rel.child_table_name);
            const childTableSingular = toSingularPascalCase(rel.child_table_name);
            
            // Tentukan nama fungsi hubungan yang betul
            const relationshipName = rel.parent_table_name === rel.child_table_name
                ? 'children' // Guna 'children' untuk hubungan kepada diri sendiri
                : toPluralCamelCase(rel.child_table_name); // Guna nama biasa untuk hubungan lain
            
            // Lakukan penggantian placeholder
            managerContent = managerContent.replace(/<<TABLE_NAME_PLURAL>>/g, parentTablePlural);
            managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_PLURAL>>/g, childTablePlural);
            managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_PLURAL_CAMEL>>/g, relationshipName);
            managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_SINGULAR>>/g, childTableSingular);

            // Bersihkan placeholder yang tidak digunakan dan baris kosong
            managerContent = managerContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            managerContent = managerContent.replace(/<<.*?>>/g, '');

            // Jana fail output
            const resourceFolder = parentTablePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'RelationManagers');
            fs.mkdirSync(outputFolderPath, { recursive: true });

            const outputFileName = `${childTableSingular}RelationManager.php`;
            const outputFilePath = path.join(outputFolderPath, outputFileName);
            
            fs.writeFileSync(outputFilePath, managerContent);
            console.log(`RelationManager generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Relation Managers generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Relation Managers:', error);
        return { success: false, message: error.message };
    }
}

// Export functions untuk digunakan di main.js
module.exports = {
    generateFilamentListPages,
    generateFilamentCreatePages,
    generateFilamentEditPages,
    generateFilamentResources,
    generateFilamentRelationManagers
};
