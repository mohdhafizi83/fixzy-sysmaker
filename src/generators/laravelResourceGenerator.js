const fs = require('fs');
const path = require('path');

// IMPORT FUNGSI BANTUAN DARI UTILS
const { 
    toSingularPascalCase,
    toPluralPascalCase,
    toPluralCamelCase,
    toFlatCase,
    readTemplate,
    buildEloquentQueryFromRules 
} = require('../utils');

/**
 * [HELPER] Menjana satu fail Resource.
 * Logik dibahagikan kepada dua: Standard (Asal) dan Custom View.
 */
async function generateSingleResource(tableName, tableData, fullSchema, basePath, templateContent, options = {}) {
    const { project: projectSettings, database: { relationships, unified_menu } } = fullSchema;
    
    // Tentukan parameter asas
    const modelName = toSingularPascalCase(tableName);
    const modelNamePlural = toPluralPascalCase(tableName);
    const isCustomView = options.isCustomView || false;

    // Nama Fail & Class
    let resourceClassName, resourceFileName, outputFolder;

    if (isCustomView) {
        // Cth: PendingPelajarsResource
        resourceClassName = options.resourceClassName;
        resourceFileName = options.resourceFileName; // Cth: PendingPelajars
        outputFolder = options.resourceFileName;     // Folder: PendingPelajars
    } else {
        // Cth: PelajarResource
        resourceClassName = `${modelName}Resource`;
        resourceFileName = `${modelName}Resource`;
        outputFolder = modelNamePlural;              // Folder: Pelajars
    }

    let resourceContent = templateContent;

    // ========================================================================
    // LANGKAH 1: PENGGANTIAN STANDARD (LOGIK ASAL 100%)
    // ========================================================================
    // Kita lakukan ini untuk KEDUA-DUA jenis supaya asas kod adalah sama.
    // Template 'Resource.template' dijangka sudah mempunyai import PelajarForm/Table.
    
    resourceContent = resourceContent.replace(/<<MODEL_NAME>>/g, modelName);
    // Untuk standard, namespace folder ialah Pelajars. Untuk Custom, kita akan betulkan nanti.
    // Tapi untuk mengekalkan import Model (use App\Models\Pelajar), kita perlukan nama model sebenar.
    
    // Placeholder <<MODEL_NAME_PLURAL>> biasanya digunakan untuk Namespace Resource & Import Table/Form.
    // Jika Custom View, kita letak nama Custom Folder (PendingPelajars) supaya Namespace betul.
    // Jika Standard, kita letak Pelajars.
    const namespaceFolder = isCustomView ? outputFolder : modelNamePlural;
    resourceContent = resourceContent.replace(/<<MODEL_NAME_PLURAL>>/g, namespaceFolder);

    // --- LOGIK ASAL: CHILDREN COUNT ---
    // (Kod ini disalin tepat dari kod asal)
    const childrenWithCount = relationships.filter(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
    if (childrenWithCount.length > 0) {
        resourceContent = resourceContent.replace('<<IMPORT_SHOW_COUNT_IN_TV>>', 'use Illuminate\\Database\\Eloquent\\Builder;');
        const childPluralCamelNames = childrenWithCount.map(r => `'${toPluralCamelCase(r.child_table_name)}'`).join(', ');
        // Nota: Kita simpan string query ini untuk digunakan/digabung nanti
        const withCountFunction = `
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCount([${childPluralCamelNames}]);
    }`;
        // Jika Custom View, kita akan override ini kemudian, tapi untuk standard kita set terus
        if (!isCustomView) {
            resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', withCountFunction);
        } else {
            // Untuk Custom View, kita simpan placeholder untuk di-inject dengan filter nanti
            // Atau jika template asal tiada placeholder ini, kita perlu uruskan.
            // Biarkan placeholder ini diganti kosong dulu jika Custom View akan buat query sendiri
             resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', '<<CUSTOM_QUERY_PLACEHOLDER>>'); 
        }
    } else {
        resourceContent = resourceContent.replace('<<IMPORT_SHOW_COUNT_IN_TV>>', '');
        if (!isCustomView) resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', '');
        else resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', '<<CUSTOM_QUERY_PLACEHOLDER>>');
    }

    // --- LOGIK ASAL: PRINT ACTION ---
    if (tableData.allow_print_view === 1) {
        resourceContent = resourceContent.replace('<<IMPORT_PRINTACTION>>', 'use Filament\\Actions\\Action;\nuse App\\Filament\\Actions\\PrintAction;');
        const printAction = `Action::make('print')
                    ->label('Print')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => request()->fullUrlWithQuery(['print' => 1]))
                    ->openUrlInNewTab(),`;
        resourceContent = resourceContent.replace('<<PRINT_ACTION>>', printAction);
    } else {
        resourceContent = resourceContent.replace('<<IMPORT_PRINTACTION>>', '');
        resourceContent = resourceContent.replace('<<PRINT_ACTION>>', '');
    }

    // --- LOGIK ASAL: EXPORT ---
    if (tableData.allow_csv_export === 1) {
        const importExport = `use App\\Filament\\Exports\\${modelName}Exporter;\nuse Filament\\Actions\\ExportAction;`;
        const exportAction = `ExportAction::make()->exporter(${modelName}Exporter::class)\n                ->enableVisibleTableColumnsByDefault(),`;
        resourceContent = resourceContent.replace('<<IMPORT_EXPORTDATA>>', importExport);
        resourceContent = resourceContent.replace('<<EXPORT_ACTION>>', exportAction);
    } else {
        resourceContent = resourceContent.replace('<<IMPORT_EXPORTDATA>>', '');
        resourceContent = resourceContent.replace('<<EXPORT_ACTION>>', '');
    }

    // --- LOGIK ASAL: IMPORT ---
    if (tableData.allow_csv_import === 1) {
        const importImport = `use App\\Filament\\Imports\\${modelName}Importer;\nuse Filament\\Actions\\ImportAction;`;
        const importAction = `ImportAction::make()->importer(${modelName}Importer::class),`;
        resourceContent = resourceContent.replace('<<IMPORT_IMPORTDATA>>', importImport);
        resourceContent = resourceContent.replace('<<IMPORT_ACTION>>', importAction);
    } else {
        resourceContent = resourceContent.replace('<<IMPORT_IMPORTDATA>>', '');
        resourceContent = resourceContent.replace('<<IMPORT_ACTION>>', '');
    }

    // --- LOGIK ASAL: RELATION MANAGERS (STANDARD) ---
    // Logik asal mengambil semua child yang show_tab=1 dan bukan one-to-one
    // Untuk Custom View, kita akan tapis senarai ini, tetapi sumber kelasnya TETAP SAMA (dari folder asal).
    let childrenForRelationManager = [];
    
    if (isCustomView) {
        // Tapis ikut pilihan user
        let allowedRelations = [];
        if (options.includedRelations) {
            try { allowedRelations = JSON.parse(options.includedRelations); } catch (e) { allowedRelations = []; }
        }
        childrenForRelationManager = relationships.filter(r => r.parent_table_name === tableName && allowedRelations.includes(r.child_table_name));
    } else {
        // Logik Standard
        childrenForRelationManager = relationships.filter(r => r.parent_table_name === tableName && r.show_tab === 1 && r.relationship_type !== 'one-to-one');
    }

    if (childrenForRelationManager.length > 0) {
        // PENTING: Import sentiasa dari folder Model Asal (Pelajars), bukan Custom Folder.
        const originalResourceFolder = toPluralPascalCase(tableName);
        
        const importManagers = childrenForRelationManager.map(r => `use App\\Filament\\Resources\\${originalResourceFolder}\\RelationManagers\\${toSingularPascalCase(r.child_table_name)}RelationManager;`).join('\n');
        const relationManagers = childrenForRelationManager.map(r => `            ${toSingularPascalCase(r.child_table_name)}RelationManager::class,`).join('\n');
        
        resourceContent = resourceContent.replace('<<IMPORT_RELATIONMANAGERS>>', importManagers);
        resourceContent = resourceContent.replace('<<RELATION_RELATIONMANAGERS>>', relationManagers);
    } else {
        resourceContent = resourceContent.replace('<<IMPORT_RELATIONMANAGERS>>', '');
        resourceContent = resourceContent.replace('<<RELATION_RELATIONMANAGERS>>', '');
    }

    // --- LOGIK ASAL: MENU ---
    if (!isCustomView) {
        let menuItem = null;
        let menuGroup = null;
        for (const topLevelItem of unified_menu) {
            if (topLevelItem.type === 'group') {
                const foundItem = topLevelItem.items.find(item => item.table_id === tableData.table_id);
                if (foundItem) { menuItem = foundItem; menuGroup = topLevelItem; break; }
            } else if (topLevelItem.table_id === tableData.table_id) {
                menuItem = topLevelItem; break;
            }
        }

        if (menuItem) {
            if (menuGroup) { 
                const groupFunction = `\n    public static function getNavigationGroup(): string\n    {\n        return '${menuGroup.name}';\n    }`;
                const sortFunction = `\n    public static function getNavigationSort(): int\n    {\n        return ${menuItem.item_order};\n    }`;
                resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONGROUP>>', groupFunction);
                resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONSORT>>', sortFunction);
            } else { 
                const sortProperty = `protected static ?int $navigationSort = ${menuItem.item_order};`;
                resourceContent = resourceContent.replace('<<SHORTCUT_MENU_ORDER>>', sortProperty);
                resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONGROUP>>', '');
                resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONSORT>>', '');
            }
            resourceContent = resourceContent.replace('<<MENU_NAME>>', menuItem.item_label);
        } else {
            resourceContent = resourceContent.replace('<<SHORTCUT_MENU_ORDER>>', '');
            resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONGROUP>>', '');
            resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONSORT>>', '');
            resourceContent = resourceContent.replace('<<MENU_NAME>>', tableData.table_view_title || modelNamePlural);
        }
    }

    // --- LOGIK ASAL: AUDIT ---
    if (projectSettings.module_log_audit === 1) {
        const auditRelation = `\n        if (auth()->check() && auth()->user()->can('view_any_audit')) {\n            $relations[] = AuditsRelationManager::class;\n        }`;
        resourceContent = resourceContent.replace('<<RELATIONS_AUDIT>>', auditRelation);
    } else {
        resourceContent = resourceContent.replace('<<RELATIONS_AUDIT>>', '');
    }

    // --- LOGIK ASAL: FLATCASE NAME ---
    resourceContent = resourceContent.replace('<<MODEL_NAME_FLATCASE>>', toFlatCase(tableName));


    // ========================================================================
    // LANGKAH 2: PENGUBAHSUAIAN KHAS UNTUK CUSTOM VIEW
    // ========================================================================
    
    if (isCustomView) {
        // 1. Override Class Name
        // Tukar "class PelajarResource" -> "class PendingPelajarResource"
        resourceContent = resourceContent.replace(`class ${modelName}Resource`, `class ${resourceClassName}`);

        // 2. Override Form & Table Call
        // Di sini kita menukar rujukan Form/Table dari standard ke Custom
        // Asal: return PelajarForm::form($form);
        // Ubah: return PendingPelajarForm::form($form);
        const standardFormClass = `${modelName}Form`;
        const customFormClass = `${resourceFileName}Form`;
        const standardTableClass = `${modelNamePlural}Table`;
        const customTableClass = `${resourceFileName}Table`;

        // Guna regex global replace untuk memastikan semua rujukan ditukar
        resourceContent = resourceContent.replace(new RegExp(standardFormClass, 'g'), customFormClass);
        resourceContent = resourceContent.replace(new RegExp(standardTableClass, 'g'), customTableClass);

        // 3. Inject Slug
        const slug = toFlatCase(options.viewName || resourceFileName);
        resourceContent = resourceContent.replace('{', `{\n    protected static ?string $slug = '${slug}';`);

        // 4. Inject Menu Custom
        if (options.menuIcon) {
            resourceContent = resourceContent.replace(/icon\s*=\s*'.*?'/, `icon = '${options.menuIcon}'`);
        }
        
        // Bersihkan placeholder menu standard jika belum dibersihkan
        resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONGROUP>>', '');
        resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONSORT>>', '');
        resourceContent = resourceContent.replace('<<SHORTCUT_MENU_ORDER>>', '');

        const customNav = `\n    protected static ?string $navigationLabel = '${options.viewName}';\n    protected static ?int $navigationSort = ${options.viewOrder || 99};`;
        resourceContent = resourceContent.replace('{', `{${customNav}`); // Append after opening brace
        resourceContent = resourceContent.replace('<<MENU_NAME>>', options.viewName);

        // 5. Inject Filter Query
        let queryBody = 'parent::getEloquentQuery()';
        if (options.filterRules) {
            try {
                const rules = JSON.parse(options.filterRules);
                const whereClause = buildEloquentQueryFromRules(rules);
                if (whereClause) queryBody += whereClause;
            } catch (e) {}
        }
        const queryFunction = `\n    public static function getEloquentQuery(): Builder\n    {\n        return ${queryBody};\n    }`;
        resourceContent = resourceContent.replace('<<CUSTOM_QUERY_PLACEHOLDER>>', queryFunction);

    } else {
        // Untuk Standard, bersihkan placeholder Custom Query jika ada
        resourceContent = resourceContent.replace('<<CUSTOM_QUERY_PLACEHOLDER>>', '');
    }

    // ========================================================================
    // LANGKAH 3: PEMBERSIHAN AKHIR
    // ========================================================================
    resourceContent = resourceContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
    resourceContent = resourceContent.replace(/<<.*?>>/g, '');

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', outputFolder);
    fs.mkdirSync(outputFolderPath, { recursive: true });
    
    const outputFilePath = path.join(outputFolderPath, `${resourceClassName}.php`);
    fs.writeFileSync(outputFilePath, resourceContent);
    console.log(`Resource generated: ${outputFilePath}`);
}


// ===================================================================================
// FUNGSI UTAMA (LOOP) - SAMA SEPERTI KOD ASAL
// ===================================================================================

async function generateFilamentResources(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/Resource.template');

        for (const tableName in tables) {
            if (tableName === 'users') continue;
            // Panggil helper dengan mode STANDARD
            await generateSingleResource(tableName, tables[tableName], fullSchema, basePath, templateContent, { isCustomView: false });
        }
        return { success: true, message: 'Filament Resources generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function generateFilamentResourcesCustomViews(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/Resource.template');
        let count = 0;

        for (const tableName in tables) {
            const tableData = tables[tableName];
            if (tableData.custom_views && tableData.custom_views.length > 0) {
                for (const view of tableData.custom_views) {
                    const viewSafeName = toPluralPascalCase(view.view_name.replace(/[^a-zA-Z0-9]/g, ''));
                    const customResourceClassName = `${viewSafeName}Resource`;

                    // Panggil helper dengan mode CUSTOM VIEW
                    await generateSingleResource(tableName, tableData, fullSchema, basePath, templateContent, {
                        isCustomView: true,
                        resourceClassName: customResourceClassName,
                        resourceFileName: viewSafeName,
                        viewName: view.view_name,
                        viewOrder: view.view_order,
                        menuIcon: view.menu_icon,
                        filterRules: view.filter_rules,
                        includedRelations: view.included_relations
                    });
                    count++;
                }
            }
        }
        return { success: true, message: `${count} Custom View Resources generated.` };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Export semua fungsi
module.exports = {
    generateFilamentResources,
    generateFilamentResourcesCustomViews,
    generateSingleResource
};