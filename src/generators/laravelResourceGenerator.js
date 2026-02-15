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
    const { project: projectSettings, database: { relationships, unified_menu, table: allTables } } = fullSchema; 
    
    // ========================================================================
    // 1. TENTUKAN NAMA ASAS (GUNAKAN MODULE NAME JIKA ADA)
    // ========================================================================
    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                        ? tableData.module_name 
                        : tableName;

    // Nama Model (Class)
    const modelName = options.modelName || toSingularPascalCase(nameSource);
    const singularFileName = options.singularFileName || '';
    
    // Nama Folder Resource Standard (Plural)
    const modelNamePlural = toPluralPascalCase(nameSource);
    
    const isCustomView = options.isCustomView || false;

    // ========================================================================
    // 2. TENTUKAN NAMA FAIL & KELAS RESOURCE
    // ========================================================================
    let resourceClassName, resourceFileName, outputFolder;

    if (isCustomView) {
        resourceClassName = options.resourceClassName;
        resourceFileName = options.resourceFileName; 
        outputFolder = options.resourceFileName;     
    } else {
        resourceClassName = `${modelName}Resource`;
        resourceFileName = `${modelName}Resource`;
        outputFolder = modelNamePlural;              
    }

    let resourceContent = templateContent;

    // ========================================================================
    // 3. PENGGANTIAN STANDARD (LOGIK ASAL + MODULE NAME)
    // ========================================================================
    
    resourceContent = resourceContent.replace(/<<MODEL_NAME>>/g, modelName);
    
    const namespaceFolder = isCustomView ? outputFolder : modelNamePlural;
    resourceContent = resourceContent.replace(/<<MODEL_NAME_PLURAL>>/g, namespaceFolder);

    // --- LOGIK: CHILDREN COUNT ---
    const childrenWithCount = relationships.filter(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
    
    if (childrenWithCount.length > 0) {
        resourceContent = resourceContent.replace('<<IMPORT_SHOW_COUNT_IN_TV>>', 'use Illuminate\\Database\\Eloquent\\Builder;');
        
        const childPluralCamelNames = childrenWithCount.map(r => {
            const childTableData = allTables[r.child_table_name];
            const childNameSource = (childTableData && childTableData.module_name && childTableData.module_name.trim() !== '')
                                    ? childTableData.module_name
                                    : r.child_table_name;
            return `'${toPluralCamelCase(childNameSource)}'`; 
        }).join(', ');
        
        const withCountFunction = `
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCount([${childPluralCamelNames}]);
    }`;
        
        if (!isCustomView) {
            resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', withCountFunction);
        } else {
             resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', '<<CUSTOM_QUERY_PLACEHOLDER>>'); 
        }
    } else {
        resourceContent = resourceContent.replace('<<IMPORT_SHOW_COUNT_IN_TV>>', '');
        if (!isCustomView) resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', '');
        else resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', '<<CUSTOM_QUERY_PLACEHOLDER>>');
    }

    // --- LOGIK: PRINT ACTION ---
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

    // --- LOGIK: EXPORT ---
    if (tableData.allow_csv_export === 1) {
        const importExport = `use App\\Filament\\Exports\\${modelName}Exporter;\nuse Filament\\Actions\\ExportAction;`;
        const exportAction = `ExportAction::make()->exporter(${modelName}Exporter::class)\n                ->enableVisibleTableColumnsByDefault(),`;
        resourceContent = resourceContent.replace('<<IMPORT_EXPORTDATA>>', importExport);
        resourceContent = resourceContent.replace('<<EXPORT_ACTION>>', exportAction);
    } else {
        resourceContent = resourceContent.replace('<<IMPORT_EXPORTDATA>>', '');
        resourceContent = resourceContent.replace('<<EXPORT_ACTION>>', '');
    }

    // --- LOGIK: IMPORT ---
    if (tableData.allow_csv_import === 1) {
        const importImport = `use App\\Filament\\Imports\\${modelName}Importer;\nuse Filament\\Actions\\ImportAction;`;
        const importAction = `ImportAction::make()->importer(${modelName}Importer::class),`;
        resourceContent = resourceContent.replace('<<IMPORT_IMPORTDATA>>', importImport);
        resourceContent = resourceContent.replace('<<IMPORT_ACTION>>', importAction);
    } else {
        resourceContent = resourceContent.replace('<<IMPORT_IMPORTDATA>>', '');
        resourceContent = resourceContent.replace('<<IMPORT_ACTION>>', '');
    }

    // --- LOGIK: RELATION MANAGERS (STANDARD) ---
    let childrenForRelationManager = [];
    
    if (isCustomView) {
        let allowedRelations = [];
        if (options.includedRelations) {
            try { allowedRelations = JSON.parse(options.includedRelations); } catch (e) { allowedRelations = []; }
        }
        childrenForRelationManager = relationships.filter(r => r.parent_table_name === tableName && allowedRelations.includes(r.child_table_name));
    } else {
        childrenForRelationManager = relationships.filter(r => r.parent_table_name === tableName && r.show_tab === 1 && r.relationship_type !== 'one-to-one');
    }

    if (childrenForRelationManager.length > 0) {
        const originalResourceFolder = toPluralPascalCase(nameSource); 
        
        const importManagers = childrenForRelationManager.map(r => {
            const childTableData = allTables[r.child_table_name];
            const childNameSource = (childTableData && childTableData.module_name && childTableData.module_name.trim() !== '')
                                    ? childTableData.module_name
                                    : r.child_table_name;
            const childManagerClass = `${toSingularPascalCase(childNameSource)}RelationManager`;
            return `use App\\Filament\\Resources\\${originalResourceFolder}\\RelationManagers\\${childManagerClass};`;
        }).join('\n');

        const relationManagers = childrenForRelationManager.map(r => {
            const childTableData = allTables[r.child_table_name];
            const childNameSource = (childTableData && childTableData.module_name && childTableData.module_name.trim() !== '')
                                    ? childTableData.module_name
                                    : r.child_table_name;
            const childManagerClass = `${toSingularPascalCase(childNameSource)}RelationManager`;
            return `            ${childManagerClass}::class,`;
        }).join('\n');
        
        resourceContent = resourceContent.replace('<<IMPORT_RELATIONMANAGERS>>', importManagers);
        resourceContent = resourceContent.replace('<<RELATION_RELATIONMANAGERS>>', relationManagers);
    } else {
        resourceContent = resourceContent.replace('<<IMPORT_RELATIONMANAGERS>>', '');
        resourceContent = resourceContent.replace('<<RELATION_RELATIONMANAGERS>>', '');
    }

    // --- LOGIK: MENU ---
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
            resourceContent = resourceContent.replace('<<MENU_NAME>>', tableData.table_view_title || toPluralPascalCase(nameSource)); 
        }
    }

    // --- LOGIK: AUDIT ---
    if (projectSettings.module_log_audit === 1) {
        const auditRelation = `\n        if (auth()->check() && auth()->user()->can('view_any_audit')) {\n            $relations[] = AuditsRelationManager::class;\n        }`;
        resourceContent = resourceContent.replace('<<RELATIONS_AUDIT>>', auditRelation);
    } else {
        resourceContent = resourceContent.replace('<<RELATIONS_AUDIT>>', '');
    }

    resourceContent = resourceContent.replace('<<MODEL_NAME_FLATCASE>>', toFlatCase(nameSource));


    // ========================================================================
    // 4. PENGUBAHSUAIAN KHAS UNTUK CUSTOM VIEW
    // ========================================================================
    
    if (isCustomView) {
        // 1. Override Class Name
        resourceContent = resourceContent.replace(`class ${modelName}Resource`, `class ${resourceClassName}`);

// 2. Override Form & Table Call
        const standardFormClass = `${modelName}Form`;
        const customFormClass = `${singularFileName}Form`; // (kekalkan pembolehubah sedia ada anda)
        const standardTableClass = `${modelNamePlural}Table`; 
        const customTableClass = `${resourceFileName}Table`; // (kekalkan pembolehubah sedia ada anda)

        // PERUBAHAN DI SINI: Tambah \\b pada RegExp untuk elak double-replace
        resourceContent = resourceContent.replace(new RegExp(`\\b${standardFormClass}\\b`, 'g'), customFormClass);
        resourceContent = resourceContent.replace(new RegExp(`\\b${standardTableClass}\\b`, 'g'), customTableClass);

        // 3. Override Pages Import (Fix dari tugasan lepas)
        const standardCreatePage = `Create${modelName}`;
        const customCreatePage = `Create${singularFileName}`; // (kekalkan pembolehubah sedia ada anda)
        const standardEditPage = `Edit${modelName}`;
        const customEditPage = `Edit${singularFileName}`; // (kekalkan pembolehubah sedia ada anda)

        // PERUBAHAN DI SINI: Tambah \\b pada RegExp
        resourceContent = resourceContent.replace(new RegExp(`\\b${standardCreatePage}\\b`, 'g'), customCreatePage);
        resourceContent = resourceContent.replace(new RegExp(`\\b${standardEditPage}\\b`, 'g'), customEditPage);

        // 4. Inject Slug
        const slug = toFlatCase(options.viewName || resourceFileName);
        resourceContent = resourceContent.replace('{', `{\n    protected static ?string $slug = '${slug}';`);

        // 5. Inject Menu Custom (FIXED LOGIC NAVIGATION)
        if (options.menuIcon) {
            resourceContent = resourceContent.replace(/icon\s*=\s*'.*?'/, `icon = '${options.menuIcon}'`);
        }
        
        // Remove standard placeholders dulu untuk elak konflik
        resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONGROUP>>', '');
        resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONSORT>>', '');
        resourceContent = resourceContent.replace('<<SHORTCUT_MENU_ORDER>>', '');

        // --- NAVIGATION GROUP FUNCTION ---
        // Anda boleh ubah 'Custom Views' kepada nama group yang dikehendaki atau ambil dari options jika ada
        const customNavGroup = `
    public static function getNavigationGroup(): string
    {
        return '${options.viewName}'; // Default guna view name atau group lain
    }`;

        // --- NAVIGATION SORT FUNCTION ---
        const customNavSort = `
    public static function getNavigationSort(): int
    {
        return ${options.viewOrder || 0};
    }`;

        // Masukkan kod navigation baru SELEPAS class declaration
        // Kita selitkan dengan cara menggantikan '{' pembuka class dengan '{' + functions
        resourceContent = resourceContent.replace('{', `{${customNavGroup}\n${customNavSort}\n`); 
        
        // Pastikan tiada $navigationLabel atau $navigationSort static property
        // (Logik replace standard di atas sudah membuangnya melalui placeholder <<SHORTCUT_MENU_ORDER>>)
        // Tetapi kita perlu pastikan <<MENU_NAME>> juga diuruskan
        
        // Jika kita guna getNavigationGroup/Label secara override function,
        // kita mungkin perlu override getNavigationLabel() juga jika mahu label berbeza dari Model Label.
        // Tapi arahan anda spesifik kepada Group dan Sort.
        
        // Untuk <<MENU_NAME>> (label asal), kita boleh biar atau replace.
        // Biasanya ini masuk ke protected static ?string $navigationLabel = '<<MENU_NAME>>';
        // Arahan anda kata REMOVE kod statik property.
        // Jadi kita replace <<MENU_NAME>> dengan string kosong atau buang barisnya.
        
        // Cari baris navigationLabel standard dan buang jika wujud (biasanya ada dalam template)
        // Template mungkin ada: protected static ?string $navigationLabel = '<<MENU_NAME>>';
        resourceContent = resourceContent.replace(/protected static \?string \$navigationLabel = '.*?';/, '');

        // 6. Inject Filter Query
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
        resourceContent = resourceContent.replace('<<CUSTOM_QUERY_PLACEHOLDER>>', '');
    }

    // ========================================================================
    // 5. PEMBERSIHAN AKHIR
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
// FUNGSI UTAMA (LOOP)
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

// Cari function ini di bahagian bawah fail dan gantikan dengan kod ini:

async function generateFilamentResourcesCustomViews(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/Resource.template');
        let count = 0;

        for (const tableName in tables) {
            const tableData = tables[tableName];
            if (tableData.custom_views && tableData.custom_views.length > 0) {
                for (const view of tableData.custom_views) {
                    
                    const viewNameClean = view.view_name.replace(/[^a-zA-Z0-9]/g, '');
                    
                    // FOLDER: Plural (PendingRegistrations)
                    const viewSafeNamePlural = toPluralPascalCase(viewNameClean);
                    
                    // FAIL: Singular (PendingRegistrationResource)
                    const viewSafeNameSingular = toSingularPascalCase(viewNameClean);
                    const customResourceClassName = `${viewSafeNameSingular}Resource`;

                    await generateSingleResource(tableName, tableData, fullSchema, basePath, templateContent, {
                        isCustomView: true,
                        resourceClassName: customResourceClassName, // Nama Class/Fail Singular
                        resourceFileName: viewSafeNamePlural,       // Nama Folder Plural (Helper guna variable ini untuk folder)
                        singularFileName: viewSafeNameSingular, 
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

module.exports = {
    generateFilamentResources,
    generateFilamentResourcesCustomViews,
    generateSingleResource
};