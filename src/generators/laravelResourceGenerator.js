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
 * Logik dibahagikan kepada dua: Standard (Asal) dan Custom Module.
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
    
    const isCustomModule = options.isCustomModule || false;

    // ========================================================================
    // 2. TENTUKAN NAMA FAIL & KELAS RESOURCE
    // ========================================================================
    let resourceClassName, resourceFileName, outputFolder;

    if (isCustomModule) {
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
    
    const namespaceFolder = isCustomModule ? outputFolder : modelNamePlural;
    resourceContent = resourceContent.replace(/<<MODEL_NAME_PLURAL>>/g, namespaceFolder);

// --- MULA: LOGIK ELOQUENT QUERY KESELURUHAN (COUNT, OWNER & FILTER) ---
    const childrenWithCount = relationships.filter(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
    const hasWithCount = childrenWithCount.length > 0;
    const isOwnerOnly = tableData.record_owner === 'current_user'; // Tangkap setting dari DB

    let filterQueryStr = '';
    if (isCustomModule && options.filterRules) {
        try {
            const parsed = typeof options.filterRules === 'string' ? JSON.parse(options.filterRules) : options.filterRules;
            
            function buildQueryString(group, depth = 3) {
                if (!group || !group.rules || group.rules.length === 0) return '';
                let condition = group.condition || 'AND';
                let indent = '    '.repeat(depth);
                let inner = '';
                
                group.rules.forEach((rule, index) => {
                    let method = (index === 0) ? 'where' : (condition === 'OR' ? 'orWhere' : 'where');
                    if (rule.condition !== undefined && rule.rules !== undefined) {
                        let subInner = buildQueryString(rule, depth + 1);
                        if (subInner) inner += `\n${indent}$q->${method}(function($q) {${subInner}\n${indent}});`;
                    } else if (rule.column) {
                        let col = rule.column; let op = rule.operator || '='; let val = rule.value || '';
                        if (val.toLowerCase() === 'null') {
                            let nullMethod = (op === '!=' || op === 'NOT LIKE') ? 'whereNotNull' : 'whereNull';
                            if (index > 0 && condition === 'OR') nullMethod = (op === '!=' || op === 'NOT LIKE') ? 'orWhereNotNull' : 'orWhereNull';
                            inner += `\n${indent}$q->${nullMethod}('${col}');`;
                        } else {
                            inner += `\n${indent}$q->${method}('${col}', '${op}', '${val}');`;
                        }
                    }
                });
                return inner;
            }

            let rootData = { condition: 'AND', rules: [] };
            if (Array.isArray(parsed)) rootData.rules = parsed;
            else if (parsed && parsed.rules) rootData = parsed;

            const finalInnerQuery = buildQueryString(rootData, 3);
            if (finalInnerQuery) filterQueryStr = `\n            ->where(function($q) {${finalInnerQuery}\n            })`;
        } catch (e) {}
    }

    // Jika mana-mana logik di atas ada, kita jana fungsi getEloquentQuery()
    if (hasWithCount || isOwnerOnly || filterQueryStr) {
        resourceContent = resourceContent.replace('<<IMPORT_SHOW_COUNT_IN_TV>>', 'use Illuminate\\Database\\Eloquent\\Builder;');
        
        let queryBody = 'parent::getEloquentQuery()';
        
        if (hasWithCount) {
            const childPluralCamelNames = childrenWithCount.map(r => {
                const childTableData = allTables[r.child_table_name];
                const childNameSource = (childTableData && childTableData.module_name && childTableData.module_name.trim() !== '') ? childTableData.module_name : r.child_table_name;
                return `'${toPluralCamelCase(childNameSource)}'`; 
            }).join(', ');
            queryBody += `->withCount([${childPluralCamelNames}])`;
        }

        if (isOwnerOnly) {
            queryBody += `\n            ->where('created_by', auth()->id())`;
        }

        if (filterQueryStr) {
            queryBody += filterQueryStr;
        }

        const queryFunction = `\n    public static function getEloquentQuery(): Builder\n    {\n        return ${queryBody};\n    }`;
        resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', queryFunction);
    } else {
        resourceContent = resourceContent.replace('<<IMPORT_SHOW_COUNT_IN_TV>>', '');
        resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', '');
    }
    // --- TAMAT LOGIK ELOQUENT QUERY ---

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
    // Pastikan ciri import dihalang 100% jika ia adalah Custom Module (!isCustomModule)
    if (tableData.allow_csv_import === 1 && !isCustomModule) {
        const importImport = `use App\\Filament\\Imports\\${modelName}Importer;\nuse Filament\\Actions\\ImportAction;`;
        const importAction = `ImportAction::make()->importer(${modelName}Importer::class),`;
        resourceContent = resourceContent.replace('<<IMPORT_IMPORTDATA>>', importImport);
        resourceContent = resourceContent.replace('<<IMPORT_ACTION>>', importAction);
    } else {
        resourceContent = resourceContent.replace('<<IMPORT_IMPORTDATA>>', '');
        resourceContent = resourceContent.replace('<<IMPORT_ACTION>>', '');
    }

// --- LOGIK: RELATION MANAGERS (STANDARD & CUSTOM MODULE) ---
    let childrenForRelationManager = [];

    if (isCustomModule) {
        // ▼▼▼ PEMBAIKAN: Baca dari tatasusunan (array) includedRelations untuk Custom Module ▼▼▼
        let includedRels = [];
        try {
            includedRels = typeof options.includedRelations === 'string' 
                ? JSON.parse(options.includedRelations || "[]") 
                : (options.includedRelations || []);
        } catch (e) {
            includedRels = [];
        }

        childrenForRelationManager = relationships.filter(r => 
            r.parent_table_name === tableName && 
            r.relationship_type !== 'one-to-one' &&
            includedRels.includes(r.child_table_name) // Hanya masukkan jika namanya ada dalam array
        );
    } else {
        // Logik Standard/Default: Gunakan tetapan show_tab = 1
        childrenForRelationManager = relationships.filter(r => 
            r.parent_table_name === tableName && 
            r.show_tab === 1 && 
            r.relationship_type !== 'one-to-one'
        );
    }

    if (childrenForRelationManager.length > 0) {
        // PENTING: Untuk Custom Module, kita nak rujuk ke folder asal base table!
        const baseTableData = allTables[tableName];
        const baseNameSource = (baseTableData && baseTableData.module_name && baseTableData.module_name.trim() !== '') 
                        ? baseTableData.module_name 
                        : tableName;
        const originalResourceFolder = toPluralPascalCase(baseNameSource); 
        
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
    // KITA SATUKAN LOGIK UNTUK KEDUA-DUA DEFAULT & CUSTOM MODULE
    let menuItem = null;
    let menuGroup = null;

    for (const topLevelItem of unified_menu) {
        if (topLevelItem.type === 'group') {
            // Guna '==' untuk keselamatan jika ID berbeza jenis (String vs Int)
            const foundItem = topLevelItem.items.find(item => 
                isCustomModule ? item.module_id == options.moduleId : item.table_id == tableData.table_id
            );
            if (foundItem) { menuItem = foundItem; menuGroup = topLevelItem; break; }
        } else {
            const isMatch = isCustomModule ? topLevelItem.module_id == options.moduleId : topLevelItem.table_id == tableData.table_id;
            if (isMatch) { menuItem = topLevelItem; break; }
        }
    }

    if (menuItem) {
        if (menuGroup) { 
            const groupFunction = `\n    public static function getNavigationGroup(): string\n    {\n        return '${menuGroup.name}';\n    }`;
            const sortFunction = `\n    public static function getNavigationSort(): int\n    {\n        return ${menuItem.item_order};\n    }`;
            resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONGROUP>>', groupFunction);
            resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONSORT>>', sortFunction);
            resourceContent = resourceContent.replace('<<SHORTCUT_MENU_ORDER>>', ''); // Buang shortcut
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
        resourceContent = resourceContent.replace('<<MENU_NAME>>', isCustomModule ? options.customModuleName : (tableData.table_view_title || toPluralPascalCase(nameSource))); 
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
    
    if (isCustomModule) {
        // 1. Override Class Name
        resourceContent = resourceContent.replace(`class ${modelName}Resource`, `class ${resourceClassName}`);

        // 2. Override Form & Table Call
        const standardFormClass = `${modelName}Form`;
        const customFormClass = `${singularFileName}Form`; 
        const standardTableClass = `${modelNamePlural}Table`; 
        const customTableClass = `${resourceFileName}Table`; 

        resourceContent = resourceContent.replace(new RegExp(`\\b${standardFormClass}\\b`, 'g'), customFormClass);
        resourceContent = resourceContent.replace(new RegExp(`\\b${standardTableClass}\\b`, 'g'), customTableClass);

        // 3. Override Pages Import 
        const standardCreatePage = `Create${modelName}`;
        const customCreatePage = `Create${singularFileName}`; 
        const standardEditPage = `Edit${modelName}`;
        const customEditPage = `Edit${singularFileName}`; 

        resourceContent = resourceContent.replace(new RegExp(`\\b${standardCreatePage}\\b`, 'g'), customCreatePage);
        resourceContent = resourceContent.replace(new RegExp(`\\b${standardEditPage}\\b`, 'g'), customEditPage);

        // 4. Inject Slug
        const slug = toFlatCase(options.customModuleName || resourceFileName);
        resourceContent = resourceContent.replace('{', `{\n    protected static ?string $slug = '${slug}';`);

        // 5. Inject Menu Custom 
        if (options.menuIcon) {
            resourceContent = resourceContent.replace(/icon\s*=\s*'.*?'/, `icon = '${options.menuIcon}'`);
        }

        // 6. Inject Filter Query & Owner Logic 
        // (Telah dipindahkan ke logik utama di bahagian atas)
        
    }
    // (Abaikan custom query placeholder kerana ia tidak lagi diperlukan)
    resourceContent = resourceContent.replace('<<CUSTOM_QUERY_PLACEHOLDER>>', '');

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
            await generateSingleResource(tableName, tables[tableName], fullSchema, basePath, templateContent, { isCustomModule: false });
        }
        return { success: true, message: 'Filament Resources generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function generateFilamentResourcesCustomModules(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/Resource.template');
        let count = 0;

        for (const tableName in tables) {
            const tableData = tables[tableName];
            if (tableData.custom_modules && tableData.custom_modules.length > 0) {
                // Tukar pembolehubah 'view' kepada 'moduleObj'
                for (const moduleObj of tableData.custom_modules) {
                    
                    // Guna module_name bukan view_name
                    const moduleNameClean = moduleObj.module_name.replace(/[^a-zA-Z0-9]/g, '');
                    
                    // FOLDER: Plural
                    const moduleSafeNamePlural = toPluralPascalCase(moduleNameClean);
                    
                    // FAIL: Singular
                    const moduleSafeNameSingular = toSingularPascalCase(moduleNameClean);
                    const customResourceClassName = `${moduleSafeNameSingular}Resource`;

                    // BACA TETAPAN OVERRIDE PERINGKAT JADUAL 
                    let tableOverrides = {};
                    if (moduleObj.settings_override) {
                        try {
                            tableOverrides = JSON.parse(moduleObj.settings_override);
                        } catch (e) {
                            console.warn(`Gagal memproses settings_override jadual untuk modul: ${moduleObj.module_name}`);
                        }
                    }

                    // Bina virtualTableData supaya logic generateSingleResource baca nilai override
                    const virtualTableData = {
                        ...tableData,
                        ...tableOverrides,
                        module_name: tableData.module_name // PENTING: Kekalkan rujukan nama asal
                    };

                    // Hantar virtualTableData menggantikan tableData asal
                    await generateSingleResource(tableName, virtualTableData, fullSchema, basePath, templateContent, {
                        isCustomModule: true,
                        moduleId: moduleObj.module_id, // <--- 1. TAMBAH BARIS INI
                        resourceClassName: customResourceClassName, 
                        resourceFileName: moduleSafeNamePlural,       
                        singularFileName: moduleSafeNameSingular, 
                        customModuleName: moduleObj.module_name,    
                        customModuleOrder: moduleObj.module_order,  
                        menuIcon: moduleObj.menu_icon,
                        filterRules: moduleObj.filter_rules,
                        includedRelations: moduleObj.included_relations,
                        ownerOnly: moduleObj.owner_only,
                        ownerField: moduleObj.owner_field
                    });
                    count++;
                }
            }
        }
        return { success: true, message: `${count} Custom Module Resources generated.` };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    generateFilamentResources,
    generateFilamentResourcesCustomModules,
    generateSingleResource
};