const pluralize = require('pluralize');
const fs = require('fs');
const path = require('path');

// IMPORT FUNGSI BANTUAN DARI UTILS
const { 
    convertDateFormatToPhp,
    toPluralPascalCase,
    toPluralCamelCase,
    toTitleCase,
    toSingularPascalCase,
    toSingularCamelCase,
    readTemplate
} = require('../utils');

/**
 * [HELPER] Menjana string PHP untuk lajur-lajur jadual.
 * Mengandungi SEMUA logik asal (Media, Relationships, Formatting, Summaries, dll).
 */
function generateTableColumnsString(tableData, relationships, tableName, projectSettings, modelNameSingular) {
    const columnsCode = [];
    // Nota: modelNameSingular diterima sebagai argumen (Module Name) untuk type hinting yang betul

    // --- MULA: LOGIK PENGESANAN TENANT FK ---
    const isOneToMany = projectSettings && projectSettings.tenancy_type === 'one_to_many';
    const isManyToMany = projectSettings && projectSettings.tenancy_type === 'many_to_many';
    const tenantTable = projectSettings && projectSettings.tenant_table;
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
    // --- TAMAT LOGIK PENGESANAN TENANT FK ---

    // Ambil fields yang visible dan susun ikut order
    // (Logik ini akan digunakan oleh Standard Generator. Custom Module akan pass tableData yang dah dimanipulasi)
    const visibleFields = Object.values(tableData.fields)
        .filter(field => {
            // Sembunyikan Tenant FK dari pandangan table list secara automatik
            if (tenantFkField && field.field_name === tenantFkField) return false;
            
            return field.hide_in_tv !== 1;
        })
        .sort((a, b) => (a.field_order ?? 999) - (b.field_order ?? 999));

    for (const field of visibleFields) {
        if (field.editable_in_tv === 1) continue;

        let controller;
        if (field.media_type === 'image') controller = 'ImageColumn';
        else if (['upload', 'gmap', 'youtube'].includes(field.media_type) || field.data_type === 'BOOLEAN') controller = 'IconColumn';
        else controller = 'TextColumn';
        
        let fieldName;
        // Logic Dot Notation untuk Relationship
        const fkRelationship = relationships.find(r => r.child_table_name === tableName && r.fk_child_field === field.field_name);
        if (fkRelationship) {
            const parentCamel = fkRelationship.parent_table_name === fkRelationship.child_table_name ? 'parent' : toSingularCamelCase(fkRelationship.parent_table_name);
            
            if(field.lookup_caption_1 && field.lookup_caption_2) {
                const combined = `${field.lookup_caption_1}_${field.lookup_caption_2}`;
                fieldName = `${parentCamel}.${combined}`;
            } else if (field.lookup_caption_1) {
                fieldName = `${parentCamel}.${field.lookup_caption_1}`;
            } else {
                 fieldName = field.field_name;
            }
        } else {
            fieldName = field.field_name;
        }
        
        let lines = [`${controller}::make('${fieldName}')`];
        lines.push(`->label('${toTitleCase(field.caption || field.field_name)}')`);
        
        // --- LOGIK IMAGE ---
        if (controller === 'ImageColumn') {
            if (field.tv_thumb_shape === 'circular') lines.push('->circular()'); else lines.push('->square()');
            if (field.tv_thumb_width) lines.push(`->imageWidth(${field.tv_thumb_width})`);
            if (field.tv_thumb_height) lines.push(`->imageHeight(${field.tv_thumb_height})`);
            if (field.image_storage_provider) lines.push(`->disk('${field.image_storage_provider}')`);
            if (field.tv_enable_zooming === 1) {
                lines.push(`->action(\n                    Action::make('Show full image')\n                        ->modalHeading(false)->modalFooter(null)\n                        ->modalContent(fn (${modelNameSingular} \$record): HtmlString => new HtmlString(\n                            \$record->${field.field_name}\n                                ? '<img src="' . Storage::url(\$record->${field.field_name}) . '" alt="${toTitleCase(field.caption || field.field_name)}" style="width: 100%;">'\n                                : '<p class="text-center">No image uploaded.</p>'\n                        ))\n                )`);
            }
        } 
        // --- LOGIK ICON ---
        else if (controller === 'IconColumn') {
            if (field.media_type === 'upload') {
                const iconValue = field.tv_icon || 'document-arrow-down';
                const storageProvider = field.file_storage_provider || 'public';
                lines.push(`->icon(fn (\$state): ?string => \$state ? 'heroicon-o-${iconValue}' : null)`);
                lines.push(`->url(fn (?${modelNameSingular} \$record) => \$record?->${field.field_name} ? Storage::disk('${storageProvider}')->url(\$record->${field.field_name}) : null, shouldOpenInNewTab: true)`);
                if (field.tv_icon_color) lines.push(`->color('${field.tv_icon_color}')`);
            } else if (field.media_type === 'gmap') {
                if (field.tv_icon) lines.push(`->icon('heroicon-o-${field.tv_icon}')`);
                if (field.tv_icon_color) lines.push(`->color('${field.tv_icon_color}')`);
                lines.push(`->action(\n                    Action::make('Show Google Map')\n                        ->modalHeading(false)->modalFooter(null)\n                        ->modalContent(function (${modelNameSingular} \$record): HtmlString {\n                            if (blank(\$record->${field.field_name})) { return new HtmlString('<p class="text-center">No map link provided.</p>'); }\n                            \$iframeCode = \$record->${field.field_name};\n                            \$responsiveIframeCode = str_replace('width="600"', 'width="100%"', \$iframeCode);\n                            \$responsiveIframeCode = str_replace('height="450"', 'height="450px"', \$responsiveIframeCode);\n                            return new HtmlString(\$responsiveIframeCode);\n                        })\n                )`);
            } else if (field.media_type === 'youtube') {
                if (field.tv_icon) lines.push(`->icon('heroicon-o-${field.tv_icon}')`);
                if (field.tv_icon_color) lines.push(`->color('${field.tv_icon_color}')`);
                lines.push(`->action(\n                    Action::make('Show Youtube Video')\n                        ->modalHeading(false)->modalFooter(null)\n                        ->modalContent(fn (${modelNameSingular} \$record): HtmlString => new HtmlString(\n                            \$record->${field.field_name}\n                                ? '<iframe src="' . e(\$record->getCleanYoutubeUrl('${field.field_name}')) . '" width="100%" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>'\n                                : '<p class="text-center">No video link provided.</p>'\n                        ))\n                )`);
            } else { 
                if (field.data_type === 'BOOLEAN') {
                    lines.push('->boolean()');
                }
                
                if (field.tv_icon) lines.push(`->icon('heroicon-o-${field.tv_icon}')`);
                if (field.tv_icon_color) lines.push(`->color('${field.tv_icon_color}')`);
            }
        } 
        // --- LOGIK TEXT ---
        else { 
            if (field.allow_sorting === 1) lines.push('->sortable()');
            if (field.tv_wrap_text === 1) lines.push('->wrap()');
            if (field.tv_font_weight && field.tv_font_weight !== 'Regular') lines.push(`->weight(FontWeight::${field.tv_font_weight})`);
            if (field.tv_text_limit) lines.push(`->limit(${field.tv_text_limit}, end: ' (more)')`);
            if (field.tv_text_color) lines.push(`->color('${field.tv_text_color}')`);
            if(field.tv_text_size && field.tv_text_size !== 'Normal') lines.push(`->size(TextSize::${field.tv_text_size})`);
        }

        // --- COMMON MODIFIERS ---
        if (field.enable_global_filter === 1 && !field.enable_individual_filter) lines.push('->searchable()');
        if (!field.enable_global_filter && field.enable_individual_filter === 1) lines.push('->searchable(isIndividual: true, isGlobal: false)');
        if (field.enable_global_filter === 1 && field.enable_individual_filter === 1) lines.push('->searchable(isIndividual: true)');
        if (field.tv_wrap_header === 1) lines.push('->wrapHeader()');
        if (field.tv_enable_toggle === 1) lines.push('->toggleable(isToggledHiddenByDefault: true)');
        else lines.push('->toggleable()');
        if (field.tv_description_tooltips === 1 && field.description) lines.push(`->tooltip('${field.description.replace(/'/g, "\\'")}')`);
        if (field.tv_alignment === 'center') lines.push('->alignCenter()');
        else if (field.tv_alignment === 'right') lines.push('->alignEnd()');
        
        // --- DATA FORMATTING ---
        const dateTypes = ['DATE', 'DATETIME', 'TIMESTAMP'];
        const numericTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'];

        if(dateTypes.includes(field.data_type)){
            const dateFormat = convertDateFormatToPhp(projectSettings.date_format);
            const timeFormat = convertDateFormatToPhp(projectSettings.time_format);
            const format = field.data_type === 'DATE' ? dateFormat : `${dateFormat} ${timeFormat}`;
            lines.push(`->dateTime('${format}')`);
        }
        
        if(numericTypes.includes(field.data_type)){
            if(field.tv_currency_code) lines.push(`->money('${field.tv_currency_code}')`);
            else lines.push(`->numeric()`);
        }

        if(field.display_type === 'rich_html') lines.push(`->html()`);
        
        if (field.display_type === 'options_list' && field.options_list_values) {
            const options = field.options_list_values.split(';;');
            if (options.length < 7) {
                const colors = ['gray', 'info', 'primary', 'warning', 'success', 'danger'];
                const matchArms = options.map((opt, i) => `        '${opt}' => '${colors[i % colors.length]}',`).join('\n');
                lines.push(`->badge()->color(fn (string \$state): string => match (\$state) {\n${matchArms}\n        })`);
            }
        }
        
if (field.data_type === 'JSON') {
            const jsonFormatter = `->formatStateUsing(function (array|string|null \$state): ?string {
            if (blank(\$state)) { return null; }
            
            // Jaring Keselamatan: Jika Eloquent memulangkan String (gagal cast automatik), decode secara manual
            if (is_string(\$state)) {
                \$decoded = json_decode(\$state, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    \$state = \$decoded;
                } else {
                    return \$state; // Jika bukan JSON, pulangkan teks mentah
                }
            }
            
            // Proses data yang telah disahkan sebagai Array
            if (is_array(\$state)) {
                // Senario A: Baca format Repeater Simple / Tags (Flat Array)
                // Cth: ["ali@gmail.com", "abu@gmail.com"]
                if (isset(\$state[0]) && !is_array(\$state[0])) {
                    return implode(', ', \$state);
                }
                
                // Senario B: Baca format Repeater (Array of Objects)
                // Cth: [["email_1" => "ali..."], ["email_1" => "abu..."]]
                \$values = [];
                foreach (\$state as \$item) {
                    if (is_array(\$item)) {
                        \$values = array_merge(\$values, array_values(\$item));
                    }
                }
                return implode(', ', array_filter(\$values));
            }
            
            return '';
        })`;
            lines.push(jsonFormatter);
        }
        
        // --- SUMMARIES ---
        const hasSummary = field.show_sum === 1 || field.show_avg_summary === 1 || field.show_count_summary === 1 || field.show_range_summary === 1;
        if (hasSummary) {
            let summaryLines = [];
            if (field.show_sum === 1) summaryLines.push('Sum::make()');
            if (field.show_avg_summary === 1) summaryLines.push('Average::make()');
            if (field.show_count_summary === 1) {
                if (field.data_type === 'BOOLEAN') summaryLines.push('Count::make()->icons()');
                else summaryLines.push('Count::make()');
            }
            if (field.show_range_summary === 1) {
                const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];
                if (numericTypes.includes(field.data_type)) summaryLines.push('Range::make()');
                else if (dateTypes.includes(field.data_type)) summaryLines.push('Range::make()->minimalDateTimeDifference()');
                else if (stringTypes.includes(field.data_type)) {
                    if (!lines.some(line => line.includes('->sortable()'))) lines.push('->sortable()');
                    summaryLines.push('Range::make()->minimalTextualDifference()');
                }
            }
            if(summaryLines.length > 0) {
                lines.push(`->summarize([\n                        ${summaryLines.join(',\n                        ')}\n                    ])`);
            }
        }
        
        columnsCode.push(lines.join('\n                    '));
    }

    return columnsCode.join(',\n                ');
}

/**
 * [HELPER] Mengaplikasikan tetapan standard jadual (actions, filters, header).
 */
function applyTableSettings(templateContent, tableData, relationships, tableName, projectSettings, modelNameSingular) {
    let tableContent = templateContent;
    // modelNameSingular sudah diterima sebagai argument (Module Name)

    // LOGIK CHILDREN COUNT & MODAL IFRAME
    const childrenWithCount = relationships.filter(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
    if (childrenWithCount.length > 0) {
        const childImports = childrenWithCount.map(r => {
            // Nota: Import child resource masih agak tricky tanpa data module_name child di sini.
            // Buat masa ini, kekal guna 'toSingularPascalCase(child_table_name)' 
            // Jika child module name berbeza, kod ini mungkin perlukan allTables lookup (belum ada di scope ini).
            // Andaian: Pengguna akan betulkan import jika nama module jauh berbeza.
            const childSingular = toSingularPascalCase(r.child_table_name);
            const childResourceFolder = toPluralPascalCase(r.child_table_name);
            return `use App\\Filament\\Resources\\${childResourceFolder}\\${childSingular}Resource;`;
        }).join('\n');
        tableContent = tableContent.replace('<<IMPORT_RESOURCES>>', childImports);

        const childPluralCamelNames = childrenWithCount.map(r => {
            const relName = r.parent_table_name === r.child_table_name ? 'children' : toPluralCamelCase(r.child_table_name);
            return `'${relName}'`;
        }).join(', ');
        const withCountFunction = `\n    public static function getEloquentQuery(): Builder\n    {\n        return parent::getEloquentQuery()->withCount([${childPluralCamelNames}]);\n    }`;
        tableContent = tableContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', withCountFunction);

        const primaryKeyField = Object.values(tableData.fields).find(f => f.primary_key === 1);
        const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];
        const firstStringField = Object.values(tableData.fields).find(f => stringTypes.includes(f.data_type.toUpperCase()));
        const modalTitleField = firstStringField || primaryKeyField;
        
        if (modalTitleField) {
            const showCountActions = childrenWithCount.map(r => {
                const childSingular = toSingularPascalCase(r.child_table_name);
                const countAttribute = r.parent_table_name === r.child_table_name ? 'children_count' : `${pluralize.plural(r.child_table_name)}_count`;
                return `
                Action::make('show${childSingular}')
                    ->label(fn (${modelNameSingular} \$record): string => '${toTitleCase(r.child_table_name)}: ' . \$record->${countAttribute})
                    ->button()->outlined()->color('info')
                    ->tooltip('Show total of ${r.child_table_name.replace(/_/g, ' ')}')
                    ->visible(fn (${modelNameSingular} \$record): bool => \$record->${countAttribute} > 0)
                    ->modalHeading(fn (${modelNameSingular} \$record) => '${toTitleCase(modalTitleField.field_name)}: ' . \$record->${modalTitleField.field_name})
                    ->modalSubmitAction(false)->modalCancelAction(false)->modalWidth('6xl')
                    ->modalContent(fn (${modelNameSingular} \$record): View =>
                        view('filament.components.modal-iframe', ['src' => ${childSingular}Resource::getUrl('index', ['${r.fk_child_field}' => \$record->${primaryKeyField ? primaryKeyField.field_name : 'id'}, 'iframe' => 1])])
                    ),`;
            }).join('');
            tableContent = tableContent.replace('<<SHOW_COUNT_IN_TV>>', showCountActions);
        } else {
             tableContent = tableContent.replace('<<SHOW_COUNT_IN_TV>>', '');
        }
    } else {
        tableContent = tableContent.replace('<<IMPORT_RESOURCES>>', '');
        tableContent = tableContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', '');
        tableContent = tableContent.replace('<<SHOW_COUNT_IN_TV>>', '');
    }

    // LOGIK SETTINGS LAIN
    if (tableData.allow_mass_delete === 1) tableContent = tableContent.replace('<<ACTION_MASS_DELETE>>', 'BulkActionGroup::make([\n                DeleteBulkAction::make(),\n            ]),');
    else tableContent = tableContent.replace('<<ACTION_MASS_DELETE>>', '');

    if (tableData.show_edit_button === 1 && tableData.enable_detail_view === 1) {
        tableContent = tableContent.replace('<<DISABLED_ROW_INTERACTION>>', '->recordUrl(null)');
        if (tableData.dv_separate_page === 1) tableContent = tableContent.replace('<<ACTION_EDIT_BUTTON>>', 'EditAction::make()->openUrlInNewTab(),');
        else tableContent = tableContent.replace('<<ACTION_EDIT_BUTTON>>', 'EditAction::make(),');
    } else {
         tableContent = tableContent.replace('<<DISABLED_ROW_INTERACTION>>', '');
         tableContent = tableContent.replace('<<ACTION_EDIT_BUTTON>>', '');
    }

    if (tableData.pagination_type === 'simple') tableContent = tableContent.replace('<<PAGINATION_TYPE>>', '->paginationMode(\'simple\')');
    else if (tableData.pagination_type === 'extreme') tableContent = tableContent.replace('<<PAGINATION_TYPE>>', '->extremePaginationLinks()');
    else tableContent = tableContent.replace('<<PAGINATION_TYPE>>', '');

    tableContent = tableContent.replace('<<ADD_DESCRIPTION>>', tableData.table_description || '');

    if (tableData.show_delete_button === 1) tableContent = tableContent.replace('<<ACTION_DELETE_BUTTON>>', 'DeleteAction::make(),');
    else tableContent = tableContent.replace('<<ACTION_DELETE_BUTTON>>', '');

    if (projectSettings.data_delete_type === 'soft') {
        if (tableData.allow_restore_delete === 1) tableContent = tableContent.replace('<<ACTION_RESTORE_BUTTON>>', 'RestoreAction::make(),');
        if (tableData.allow_force_delete === 1) tableContent = tableContent.replace('<<ACTION_FORCEDELETE_BUTTON>>', 'ForceDeleteAction::make(),');
        if (tableData.allow_restore_delete === 1 || tableData.allow_force_delete === 1) tableContent = tableContent.replace('<<TRASHED_FILTER>>', 'TrashedFilter::make(),');
    } else {
        tableContent = tableContent.replace('<<ACTION_RESTORE_BUTTON>>', '').replace('<<ACTION_FORCEDELETE_BUTTON>>', '').replace('<<TRASHED_FILTER>>', '');
    }

    if (tableData.allow_pagination === 0) tableContent = tableContent.replace('<<DISABLED_PAGINATION>>', '->paginated(false)');
    else tableContent = tableContent.replace('<<DISABLED_PAGINATION>>', '');

    if (tableData.dv_separate_page === 1) tableContent = tableContent.replace('<<OPEN_TO_NEW_TAB>>', '->openRecordUrlInNewTab()');
    else tableContent = tableContent.replace('<<OPEN_TO_NEW_TAB>>', '');

    if (tableData.enable_detail_view === 0) tableContent = tableContent.replace('<<DISABLED_DETAILVIEW>>', '->recordUrl(null)');
    else tableContent = tableContent.replace('<<DISABLED_DETAILVIEW>>', '');

    if (tableData.allow_print_view === 1) tableContent = tableContent.replace('<<SHOW_ALL_FOR_PRINT>>', `->when((bool) request()->query('print'), fn (Table \$table) => \$table->paginated(false),)`);
    else tableContent = tableContent.replace('<<SHOW_ALL_FOR_PRINT>>', '');

    return tableContent;
}

/**
 * [UTAMA] Menjana fail Table Class standard.
 */
async function generateFilamentTablesTable(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/TablesTable.template');

        for (const tableName in tables) {
            if (tableName === 'users') continue;

            const tableData = tables[tableName];
            
            // ========================================================================
            // LOGIK PENAMAAN BARU (MODULE NAME)
            // ========================================================================
            const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                                ? tableData.module_name 
                                : tableName;

            const modelNameSingular = toSingularPascalCase(nameSource); // StudentInfo
            const modelNamePlural = toPluralPascalCase(nameSource); // StudentInfos

            let tableContent = templateContent
                .replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular)
                .replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);

            // 1. Jana Columns (Pass modelNameSingular untuk type hinting)
            const columnsCode = generateTableColumnsString(tableData, relationships, tableName, projectSettings, modelNameSingular);
            tableContent = tableContent.replace('<<ALL_COLUMNS>>', columnsCode);

            // 2. Apply Settings
            tableContent = applyTableSettings(tableContent, tableData, relationships, tableName, projectSettings, modelNameSingular);

            // 3. Clean Up & Save
            tableContent = tableContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '').replace(/<<.*?>>/g, '');

            // Use Statement Cleanup
            const allUseStatements = tableContent.match(/use (.*?);/g) || [];
            let finalContent = tableContent;
            for (const useStmt of allUseStatements) {
                const match = useStmt.match(/use (?:.*\\)?(\w+)(?: as \w+)?;$/);
                if (match) {
                    const className = match[1];
                    const regex = new RegExp(`\\b${className}\\b`, 'g');
                    const occurrences = (finalContent.match(regex) || []).length;
                    if (occurrences <= 1) finalContent = finalContent.replace(useStmt + '\n', '');
                }
            }
            
            const resourceFolder = modelNamePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Tables');
            fs.mkdirSync(outputFolderPath, { recursive: true });
            
            const outputFilePath = path.join(outputFolderPath, `${modelNamePlural}Table.php`);
            fs.writeFileSync(outputFilePath, finalContent);
            console.log(`Table Class generated (Final): ${modelNamePlural}Table.php`);
        }
        
        return { success: true, message: 'Filament Table Classes (Final) generated successfully.' };
    } catch (error) {
        console.error('Failed to generate Filament Table Classes:', error);
        return { success: false, message: error.message };
    }
}

/**
 * [BARU] Menjana fail Table Class khas untuk Custom Module.
 */
function generateSingleTableClass(basePath, resourceFolder, className, tableData, fullSchema, tableName) {
    const { project: projectSettings, database: { relationships } } = fullSchema;
    const templateContent = readTemplate('app/Filament/Resources/TablesTable.template');
    
    // Custom Module guna Model Standard (Module Name)
    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                        ? tableData.module_name 
                        : tableName;
    const modelNameSingular = toSingularPascalCase(nameSource);
    
    // Namespace untuk table class ini adalah custom folder
    // Tapi nama model adalah standard
    // Kita perlu override <<TABLE_NAME_PLURAL>> di sini untuk menjadi resourceFolder supaya namespace betul
    // namespace App\Filament\Resources\PendingRegistrations\Tables;
    
    // 1. Init Template
    let tableContent = templateContent
        .replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular)
        .replace(/<<TABLE_NAME_PLURAL>>/g, resourceFolder); // Namespace guna custom folder
    
    // 2. Override Class Name
    // Kita guna regex untuk cari class definisi asal dan ganti dengan yang baru
    tableContent = tableContent.replace(/class\s+\w+Table/, `class ${className}`);

    // 3. Jana Columns (Guna Helper yang sama)
    const columnsCode = generateTableColumnsString(tableData, relationships, tableName, projectSettings, modelNameSingular);
    tableContent = tableContent.replace('<<ALL_COLUMNS>>', columnsCode);

    // 4. Apply Settings (Custom view biasanya warisi settings standard)
    tableContent = applyTableSettings(tableContent, tableData, relationships, tableName, projectSettings, modelNameSingular);

    // 5. Clean Up
    tableContent = tableContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '').replace(/<<.*?>>/g, '');

    // 6. --- IMPORT CLEANUP FOR CUSTOM VIEW --- (Pembetulan Rule #2)
    const allUseStatements = tableContent.match(/use (.*?);/g) || [];
    let finalContent = tableContent;
    for (const useStmt of allUseStatements) {
        const match = useStmt.match(/use (?:.*\\)?(\w+)(?: as \w+)?;$/);
        if (match) {
            const className = match[1];
            const regex = new RegExp(`\\b${className}\\b`, 'g');
            const occurrences = (finalContent.match(regex) || []).length;
            if (occurrences <= 1) finalContent = finalContent.replace(useStmt + '\n', '');
        }
    }

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Tables');
    if (!fs.existsSync(outputFolderPath)) fs.mkdirSync(outputFolderPath, { recursive: true });
    
    fs.writeFileSync(path.join(outputFolderPath, `${className}.php`), finalContent);
    console.log(`   - Table Class generated: ${className}.php`);
}

async function generateFilamentTablesCustomModules(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        let count = 0;

        for (const tableName in tables) {
            const tableData = tables[tableName];
            if (tableData.custom_modules && tableData.custom_modules.length > 0) {
                for (const moduleObj of tableData.custom_modules) { 
                    const moduleNameClean = moduleObj.module_name.replace(/[^a-zA-Z0-9]/g, '');

                    // FOLDER & FAIL: Plural
                    const moduleSafeNamePlural = toPluralPascalCase(moduleNameClean);
                    
                    // Nama Class Table
                    const tableClassName = `${moduleSafeNamePlural}Table`; 

                    // --- BACA TETAPAN OVERRIDE PERINGKAT JADUAL (TABLE LEVEL) ---
                    let tableOverrides = {};
                    if (moduleObj.settings_override) {
                        try {
                            tableOverrides = JSON.parse(moduleObj.settings_override);
                        } catch (e) {
                            console.warn(`Gagal memproses settings_override jadual untuk modul: ${moduleObj.module_name}`);
                        }
                    }

                    // --- BINA VIRTUAL TABLE DATA UNTUK CUSTOM MODULE ---
// ▼▼▼ PEMBAIKAN GENERATOR: SALIN DEFAULT DAHULU, KEMUDIAN OVERRIDE ▼▼▼
                    const virtualFields = {};
                    
                    // 1. Salin SEMUA medan dari jadual asal (Default Module)
                    for (const [fName, fData] of Object.entries(tableData.fields)) {
                        virtualFields[fName] = { ...fData }; // Deep copy
                    }

                    // 2. Tindihkan (Override) dengan tetapan khusus Custom Module jika wujud
                    if (moduleObj.fields && Array.isArray(moduleObj.fields)) {
                        moduleObj.fields.forEach(f => {
                            const fieldId = parseInt(f.field_id, 10);
                            
                            let fieldName = null;
                            for (const [fName, fData] of Object.entries(tableData.fields)) {
                                if (parseInt(fData.field_id, 10) === fieldId) {
                                    fieldName = fName;
                                    break;
                                }
                            }

                            if (fieldName && virtualFields[fieldName]) {
                                // Tindih status Editable di Table
                                if (f.isReadonly === true || f.is_readonly === 1) {
                                    // Custom module dipaksa read-only, jadi di table pun disable edit inline
                                    virtualFields[fieldName].editable_in_tv = 0; 
                                }
                                
                                // Tindih susunan (Order)
                                if (f.display_order !== undefined) {
                                    virtualFields[fieldName].field_order = f.display_order;
                                }

                                // Tindih sebarang Settings Override (Cth: hide_in_tv, dll)
                                if (f.settings_override) {
                                    try {
                                        const overrides = typeof f.settings_override === 'string' ? JSON.parse(f.settings_override) : f.settings_override;
                                        Object.assign(virtualFields[fieldName], overrides);
                                    } catch (e) {
                                        console.warn(`Gagal memproses settings_override untuk medan: ${fieldName}`);
                                    }
                                }
                            }
                        });
                    }
                    // ▲▲▲ TAMAT PEMBAIKAN GENERATOR ▲▲▲

                    // Gabungkan override jadual ke dalam table data
                    const virtualTableData = { 
                        ...tableData, 
                        ...tableOverrides,
                        fields: virtualFields, 
                        module_name: tableData.module_name // PENTING: Kekalkan rujukan nama asal untuk Standard Model
                    };

                    generateSingleTableClass(
                        basePath,
                        moduleSafeNamePlural, // resourceFolder (Plural)
                        tableClassName,       // className
                        virtualTableData, 
                        fullSchema,
                        tableName
                    );
                    count++;
                }
            }
        }
        return { success: true, message: `${count} Custom Module Tables generated.` };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    generateFilamentTablesTable,
    generateSingleTableClass,
    generateTableColumnsString,
    generateFilamentTablesCustomModules
}