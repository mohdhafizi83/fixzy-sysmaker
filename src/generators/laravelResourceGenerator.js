// Filament Resource class generator (Fixzy SysMaker).
// Emits app/Filament/Resources/<Folder>/<Model>Resource.php (navigation,
// cluster wiring, filter/query closures) for base tables and custom modules.
const fs = require('fs');
const path = require('path');

// IMPORT FUNGSI BANTUAN DARI UTILS
const {
    toSingularPascalCase,
    toPluralPascalCase,
    toPluralCamelCase,
    toSingularCamelCase,
    toFlatCase,
} = require('../utils');
const { renderTemplate } = require('../render/engine');

const TEMPLATE = 'app/Filament/Resources/Resource.php.njk';

/**
 * [HELPER] Generate one Resource file.
 * Standard (table-backed) and Custom Module modes share one template; all
 * substitutions are supplied as a plain context object (1:1 with the former
 * <<PLACEHOLDER>> names).
 */
async function generateSingleResource(tableName, tableData, fullSchema, basePath, _unused, options = {}) {
    const { project: projectSettings, database: { relationships, unified_menu, table: allTables } } = fullSchema;

    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '')
                        ? tableData.module_name
                        : tableName;

    const modelName = options.modelName || toSingularPascalCase(nameSource);
    const singularFileName = options.singularFileName || '';

    const modelNamePlural = toPluralPascalCase(nameSource);
    const isCustomModule = options.isCustomModule || false;

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

    const namespaceFolder = isCustomModule ? outputFolder : modelNamePlural;

    // --- Tenant scoping property ---
    const isOneToMany = projectSettings.tenancy_type === 'one_to_many';
    const isManyToMany = projectSettings.tenancy_type === 'many_to_many';
    const tenantTable = projectSettings.tenant_table;
    let tenantFkField = null;

    if ((isOneToMany || isManyToMany) && tenantTable && tableName !== tenantTable && tableName !== 'users') {
        const tenantRel = relationships.find(r => r.parent_table_name === tenantTable && r.child_table_name === tableName);
        if (tenantRel) tenantFkField = tenantRel.fk_child_field;
        else {
            const fallbackFk = toSingularCamelCase(tenantTable) + '_id';
            if (Object.values(tableData.fields).some(f => f.field_name === fallbackFk)) tenantFkField = fallbackFk;
            else if (Object.values(tableData.fields).some(f => f.field_name === tenantTable + '_id')) tenantFkField = tenantTable + '_id';
        }
    }

    let tenantScopingProperty = '';
    if (isManyToMany && (tableName === tenantTable || !tenantFkField)) {
        tenantScopingProperty = `    protected static bool $isScopedToTenant = false;\n`;
    }

    // --- Eloquent query (count, owner, filter, tenant scope) ---
    const childrenWithCount = relationships.filter(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
    const hasWithCount = childrenWithCount.length > 0;
    const isOwnerOnly = tableData.record_owner === 'current_user';

    let filterQueryStr = '';
    if (isCustomModule && options.filterRules) {
        try {
            const parsed = typeof options.filterRules === 'string' ? JSON.parse(options.filterRules) : options.filterRules;

            /**
             * Recursively compile a filter rule group into Eloquent query
             * chain fragments ($q->where / orWhere / whereIn / null checks).
             * @param {object} group {condition: 'AND'|'OR', rules: []}
             * @param {number} [depth=3] indentation depth
             * @returns {string} PHP query chain inner code ('' when empty)
             */
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
                        } else if (op === 'IN' || op === 'NOT IN') {
                            // Comma-separated value list -> whereIn / whereNotIn.
                            let inMethod = op === 'IN' ? 'whereIn' : 'whereNotIn';
                            if (index > 0 && condition === 'OR') inMethod = op === 'IN' ? 'orWhereIn' : 'orWhereNotIn';
                            const list = String(val).split(',').map((s) => s.trim()).filter((s) => s !== '')
                                .map((s) => `'${s.replace(/'/g, "\\'")}'`).join(', ');
                            if (list) inner += `\n${indent}$q->${inMethod}('${col}', [${list}]);`;
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

    const needsTenantScope = (isOneToMany && tenantFkField);

    let importShowCount = '';
    let functionShowCount = '';
    if (hasWithCount || isOwnerOnly || filterQueryStr || needsTenantScope) {
        importShowCount = 'use Illuminate\\Database\\Eloquent\\Builder;';

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

        if (needsTenantScope) {
            queryBody += `\n            ->where('${tenantFkField}', auth()->user()->${tenantFkField})`;
        }

        if (filterQueryStr) {
            queryBody += filterQueryStr;
        }

        functionShowCount = `\n    public static function getEloquentQuery(): Builder\n    {\n        return ${queryBody};\n    }`;
    }

    // --- Print action ---
    let importPrintAction = '';
    let printAction = '';
    if (tableData.allow_print_view === 1) {
        importPrintAction = 'use Filament\\Actions\\Action;\nuse App\\Filament\\Actions\\PrintAction;';
        printAction = `Action::make('print')
                    ->label('Print')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => request()->fullUrlWithQuery(['print' => 1]))
                    ->openUrlInNewTab(),`;
    }

    // --- Export ---
    let importExportData = '';
    let exportAction = '';
    if (tableData.allow_csv_export === 1) {
        importExportData = `use App\\Filament\\Exports\\${modelName}Exporter;\nuse Filament\\Actions\\ExportAction;`;
        exportAction = `ExportAction::make()->exporter(${modelName}Exporter::class)\n                /*->enableVisibleTableColumnsByDefault()*/,`;
    }

    // --- Import ---
    let importImportData = '';
    let importAction = '';
    if (tableData.allow_csv_import === 1 && !isCustomModule) {
        importImportData = `use App\\Filament\\Imports\\${modelName}Importer;\nuse Filament\\Actions\\ImportAction;`;
        importAction = `ImportAction::make()->importer(${modelName}Importer::class),`;
    }

    // --- Relation managers ---
    let childrenForRelationManager = [];

    if (isCustomModule) {
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
            includedRels.includes(r.child_table_name)
        );
    } else {
        childrenForRelationManager = relationships.filter(r =>
            r.parent_table_name === tableName &&
            r.show_tab === 1 &&
            r.relationship_type !== 'one-to-one'
        );
    }

    let importRelationManagers = '';
    let relationRelationManagers = '';
    if (childrenForRelationManager.length > 0) {
        const baseTableData = allTables[tableName];
        const baseNameSource = (baseTableData && baseTableData.module_name && baseTableData.module_name.trim() !== '')
                        ? baseTableData.module_name
                        : tableName;
        const originalResourceFolder = toPluralPascalCase(baseNameSource);

        // Shared naming with the model + RelationManager generators so the
        // imported class names match the files actually written (multi-FK
        // disambiguation, 2026-09-30).
        const { computeModelRelationNames } = require('./laravelDatabaseGenerator');
        const naming = computeModelRelationNames(tableName, relationships, allTables);

        importRelationManagers = childrenForRelationManager.map(r => {
            const childTableData = allTables[r.child_table_name];
            const childNameSource = (childTableData && childTableData.module_name && childTableData.module_name.trim() !== '')
                                    ? childTableData.module_name
                                    : r.child_table_name;
            const childManagerClass = (naming.managerClass.get(r) || toSingularPascalCase(childNameSource)) + 'RelationManager';
            return `use App\\Filament\\Resources\\${originalResourceFolder}\\RelationManagers\\${childManagerClass};`;
        }).join('\n');

        relationRelationManagers = childrenForRelationManager.map(r => {
            const childTableData = allTables[r.child_table_name];
            const childNameSource = (childTableData && childTableData.module_name && childTableData.module_name.trim() !== '')
                                    ? childTableData.module_name
                                    : r.child_table_name;
            const childManagerClass = (naming.managerClass.get(r) || toSingularPascalCase(childNameSource)) + 'RelationManager';
            return `            ${childManagerClass}::class,`;
        }).join('\n');
    }

    // --- Menu ---
    let menuItem = null;
    let menuGroup = null;

    for (const topLevelItem of unified_menu) {
        if (topLevelItem.type === 'group') {
            const foundItem = topLevelItem.items.find(item => {
                if (isCustomModule) return item.module_id == options.moduleId;
                // Name match is authoritative: menu items carry table_name,
                // and fixtures/imports can share table_id across items.
                if (item.table_name) return item.table_name === tableName;
                return item.table_id == tableData.table_id;
            });
            if (foundItem) { menuItem = foundItem; menuGroup = topLevelItem; break; }
        } else {
            let isMatch;
            if (isCustomModule) isMatch = topLevelItem.module_id == options.moduleId;
            else if (topLevelItem.table_name) isMatch = topLevelItem.table_name === tableName;
            else isMatch = topLevelItem.table_id == tableData.table_id;
            if (isMatch) { menuItem = topLevelItem; break; }
        }
    }

    let functionGetNavigationGroup = '';
    let functionGetNavigationSort = '';
    let shortcutMenuOrder = '';
    let menuName;

    if (menuItem) {
        if (menuGroup) {
            functionGetNavigationGroup = `\n    public static function getNavigationGroup(): string\n    {\n        return '${menuGroup.name}';\n    }`;
            functionGetNavigationSort = `\n    public static function getNavigationSort(): int\n    {\n        return ${menuItem.item_order};\n    }`;
        } else {
            shortcutMenuOrder = `protected static ?int $navigationSort = ${menuItem.item_order};`;
        }
        menuName = menuItem.item_label;
    } else {
        menuName = isCustomModule ? options.customModuleName : (tableData.table_view_title || toPluralPascalCase(nameSource));
    }

    // --- Navigation badge (Menu Management > Show record count) ---
    // The menu item's show_record_count flag surfaces the total record
    // count as a Filament navigation badge.
    let functionNavigationBadge = '';
    if (menuItem && Number(menuItem.show_record_count) === 1) {
        // Count via getEloquentQuery() so tenant/owner/filter scoping is
        // respected — the badge matches what the list page shows.
        functionNavigationBadge = `\n    public static function getNavigationBadge(): ?string\n    {\n        return (string) static::getEloquentQuery()->count();\n    }`;
    }

    // --- Slug ---
    const finalSlug = isCustomModule
        ? toFlatCase(options.customModuleName || resourceFileName)
        : toFlatCase(nameSource);

    // --- Audit ---
    let relationsAudit = '';
    if (projectSettings.module_log_audit === 1) {
        relationsAudit = `\n        if (auth()->check() && auth()->user()->can('view_any_audit')) {\n            $relations[] = AuditsRelationManager::class;\n        }`;
    }

    // --- Approvals (per-table state machine) ---
    let relationsApproval = '';
    if (require('./approvalConfig').parseApprovalConfig(tableData)) {
        relationsApproval = `\n        $relations[] = ApprovalHistoryRelationManager::class;`;
    }

    // --- Attachments (multi-file documents per record) ---
    // Generic table-level manager only; field-level attachment fields
    // render their own FileUpload and must not double up the manager.
    let relationsAttachment = '';
    if (require('./attachmentConfig').tableUsesGenericAttachments(tableData)) {
        relationsAttachment = `\n        $relations[] = AttachmentsRelationManager::class;`;
    }
    const context = {
        model_name: modelName,
        model_name_plural: namespaceFolder,
        tenant_scoping_property: tenantScopingProperty,
        import_show_count_in_tv: importShowCount,
        function_show_count_in_tv: functionShowCount,
        import_printaction: importPrintAction,
        print_action: printAction,
        import_exportdata: importExportData,
        export_action: exportAction,
        import_importdata: importImportData,
        import_action: importAction,
        import_relationmanagers: importRelationManagers,
        relation_relationmanagers: relationRelationManagers,
        function_getnavigationgroup: functionGetNavigationGroup,
        function_getnavigationsort: functionGetNavigationSort,
        function_navigation_badge: functionNavigationBadge,
        shortcut_menu_order: shortcutMenuOrder,
        menu_name: menuName,
        relations_audit: relationsAudit,
        relations_approval: relationsApproval,
        relations_attachment: relationsAttachment,
        audit_enabled: projectSettings.module_log_audit === 1,
        model_name_flatcase: finalSlug,
    };

    let resourceContent = renderTemplate(TEMPLATE, context);

    // ========================================================================
    // Custom module post-processing (mirrors legacy string overrides)
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

        // 4. Inject Menu Custom Icon
        if (options.menuIcon) {
            resourceContent = resourceContent.replace(/icon\s*=\s*'.*?'/, `icon = '${options.menuIcon}'`);
        }
    }

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', outputFolder);
    fs.mkdirSync(outputFolderPath, { recursive: true });

    const outputFilePath = path.join(outputFolderPath, `${resourceClassName}.php`);
    fs.writeFileSync(outputFilePath, resourceContent);
    console.log(`Resource generated: ${outputFilePath}`);
}

// ===================================================================================
// MAIN FUNCTIONS (LOOP)
// ===================================================================================

/**
 * Generate a Filament Resource class for every non-users base table.
 * @param {object} fullSchema assembled project schema
 * @param {string} basePath generated app root
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function generateFilamentResources(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;

        for (const tableName in tables) {
            if (tableName === 'users') continue;
            await generateSingleResource(tableName, tables[tableName], fullSchema, basePath, null, { isCustomModule: false });
        }
        return { success: true, message: 'Filament Resources generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Generate a Filament Resource class per custom module (virtual table =
 * base table + settings_override merged).
 * @param {object} fullSchema assembled project schema
 * @param {string} basePath generated app root
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function generateFilamentResourcesCustomModules(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        let count = 0;

        for (const tableName in tables) {
            const tableData = tables[tableName];
            if (tableData.custom_modules && tableData.custom_modules.length > 0) {
                for (const moduleObj of tableData.custom_modules) {
                    const moduleNameClean = moduleObj.module_name.replace(/[^a-zA-Z0-9]/g, '');
                    const moduleSafeNamePlural = toPluralPascalCase(moduleNameClean);
                    const moduleSafeNameSingular = toSingularPascalCase(moduleNameClean);
                    const customResourceClassName = `${moduleSafeNameSingular}Resource`;

                    let tableOverrides = {};
                    if (moduleObj.settings_override) {
                        try {
                            tableOverrides = JSON.parse(moduleObj.settings_override);
                        } catch (e) {
                            console.warn(`Failed to process table settings_override for module: ${moduleObj.module_name}`);
                        }
                    }

                    const virtualTableData = {
                        ...tableData,
                        ...tableOverrides,
                        module_name: tableData.module_name
                    };

                    await generateSingleResource(tableName, virtualTableData, fullSchema, basePath, null, {
                        isCustomModule: true,
                        moduleId: moduleObj.module_id,
                        resourceClassName: customResourceClassName,
                        resourceFileName: moduleSafeNamePlural,
                        singularFileName: moduleSafeNameSingular,
                        customModuleName: moduleObj.module_name,
                        customModuleOrder: moduleObj.module_order,
                        menuIcon: moduleObj.menu_icon,
                        filterRules: moduleObj.filter_rules,
                        includedRelations: moduleObj.included_relations
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
