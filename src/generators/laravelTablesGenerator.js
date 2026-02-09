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
 * [VERSI AKHIR LENGKAP] Menjana fail ...Table.php Laravel Filament untuk setiap resource.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentTablesTable(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;
        
        const templateContent = readTemplate('app/Filament/Resources/TablesTable.template');

        for (const tableName in tables) {
            if (tableName === 'users') continue;

            let tableContent = templateContent;
            const tableData = tables[tableName];
            
            // --- FASA 1: KERANGKA UTAMA ---
            
            const modelNameSingular = toSingularPascalCase(tableName);
            const modelNamePlural = toPluralPascalCase(tableName);
            tableContent = tableContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);
            tableContent = tableContent.replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);

            const childrenWithCount = relationships.filter(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
            if (childrenWithCount.length > 0) {
                const childImports = childrenWithCount.map(r => {
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
            }

            if (tableData.allow_mass_delete === 1) tableContent = tableContent.replace('<<ACTION_MASS_DELETE>>', 'BulkActionGroup::make([\n                DeleteBulkAction::make(),\n            ]),');
            if (tableData.show_edit_button === 1 && tableData.enable_detail_view === 1) {
                tableContent = tableContent.replace('<<DISABLED_ROW_INTERACTION>>', '->recordUrl(null)');
                if (tableData.dv_separate_page === 1) tableContent = tableContent.replace('<<ACTION_EDIT_BUTTON>>', 'EditAction::make()->openUrlInNewTab(),');
                else tableContent = tableContent.replace('<<ACTION_EDIT_BUTTON>>', 'EditAction::make(),');
            }
            if (tableData.pagination_type === 'simple') tableContent = tableContent.replace('<<PAGINATION_TYPE>>', '->paginationMode(\'simple\')');
            else if (tableData.pagination_type === 'extreme') tableContent = tableContent.replace('<<PAGINATION_TYPE>>', '->extremePaginationLinks()');
            tableContent = tableContent.replace('<<ADD_DESCRIPTION>>', tableData.table_description || '');
            if (tableData.show_delete_button === 1) tableContent = tableContent.replace('<<ACTION_DELETE_BUTTON>>', 'DeleteAction::make(),');
            if (projectSettings.data_delete_type === 'soft') {
                if (tableData.allow_restore_delete === 1) tableContent = tableContent.replace('<<ACTION_RESTORE_BUTTON>>', 'RestoreAction::make(),');
                if (tableData.allow_force_delete === 1) tableContent = tableContent.replace('<<ACTION_FORCEDELETE_BUTTON>>', 'ForceDeleteAction::make(),');
                if (tableData.allow_restore_delete === 1 || tableData.allow_force_delete === 1) tableContent = tableContent.replace('<<TRASHED_FILTER>>', 'TrashedFilter::make(),');
            }
            if (tableData.allow_pagination === 0) tableContent = tableContent.replace('<<DISABLED_PAGINATION>>', '->paginated(false)');
            if (tableData.dv_separate_page === 1) tableContent = tableContent.replace('<<OPEN_TO_NEW_TAB>>', '->openRecordUrlInNewTab()');
            if (tableData.enable_detail_view === 0) tableContent = tableContent.replace('<<DISABLED_DETAILVIEW>>', '->recordUrl(null)');
            if (childrenWithCount.length > 0) {
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
                }
            }
            if (tableData.allow_print_view === 1) tableContent = tableContent.replace('<<SHOW_ALL_FOR_PRINT>>', `->when((bool) request()->query('print'), fn (Table \$table) => \$table->paginated(false),)`);
            
            // --- FASA 2: PENJANAAN LAJUR JADUAL ---
            const columnsCode = [];
            const visibleFields = Object.values(tableData.fields)
                .filter(field => field.hide_in_tv !== 1)
                .sort((a, b) => (a.field_order ?? 999) - (b.field_order ?? 999));

            for (const field of visibleFields) {
                if (field.editable_in_tv === 1) continue;

                let controller;
                if (field.media_type === 'image') controller = 'ImageColumn';
                else if (['upload', 'gmap', 'youtube'].includes(field.media_type) || field.data_type === 'BOOLEAN') controller = 'IconColumn';
                else controller = 'TextColumn';
                
                let fieldName;
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
                
                if (controller === 'ImageColumn') {
                    if (field.tv_thumb_shape === 'circular') lines.push('->circular()'); else lines.push('->square()');
                    if (field.tv_thumb_width) lines.push(`->imageWidth(${field.tv_thumb_width})`);
                    if (field.tv_thumb_height) lines.push(`->imageHeight(${field.tv_thumb_height})`);
                    if (field.image_storage_provider) lines.push(`->disk('${field.image_storage_provider}')`);
                    if (field.tv_enable_zooming === 1) {
                        lines.push(`->action(\n                    Action::make('Show full image')\n                        ->modalHeading(false)->modalFooter(null)\n                        ->modalContent(fn (${modelNameSingular} \$record): HtmlString => new HtmlString(\n                            \$record->${field.field_name}\n                                ? '<img src="' . Storage::url(\$record->${field.field_name}) . '" alt="${toTitleCase(field.caption || field.field_name)}" style="width: 100%;">'\n                                : '<p class="text-center">No image uploaded.</p>'\n                        ))\n                )`);
                    }
                } else if (controller === 'IconColumn') {
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
                        // ▼▼▼ LOGIK BAHARU UNTUK BOOLEAN (Arahan 1.27) ▼▼▼
                        if (field.data_type === 'BOOLEAN') {
                            lines.push('->boolean()');
                        }
                        // ▲▲▲ TAMAT LOGIK BAHARU ▲▲▲
                        
                        if (field.tv_icon) lines.push(`->icon('heroicon-o-${field.tv_icon}')`);
                        if (field.tv_icon_color) lines.push(`->color('${field.tv_icon_color}')`);
                    }
                } else { // TextColumn
                    if (field.allow_sorting === 1) lines.push('->sortable()');
                    if (field.tv_wrap_text === 1) lines.push('->wrap()');
                    if (field.tv_font_weight && field.tv_font_weight !== 'Regular') lines.push(`->weight(FontWeight::${field.tv_font_weight})`);
                    if (field.tv_text_limit) lines.push(`->limit(${field.tv_text_limit}, end: ' (more)')`);
                    if (field.tv_text_color) lines.push(`->color('${field.tv_text_color}')`);
                    if(field.tv_text_size && field.tv_text_size !== 'Normal') lines.push(`->size(TextSize::${field.tv_text_size})`);
                }

                if (field.enable_global_filter === 1 && !field.enable_individual_filter) lines.push('->searchable()');
                if (!field.enable_global_filter && field.enable_individual_filter === 1) lines.push('->searchable(isIndividual: true, isGlobal: false)');
                if (field.enable_global_filter === 1 && field.enable_individual_filter === 1) lines.push('->searchable(isIndividual: true)');
                if (field.tv_wrap_header === 1) lines.push('->wrapHeader()');
                if (field.tv_enable_toggle === 1) lines.push('->toggleable(isToggledHiddenByDefault: true)');
                else lines.push('->toggleable()');
                if (field.tv_description_tooltips === 1 && field.description) lines.push(`->tooltip('${field.description.replace(/'/g, "\\'")}')`);
                if (field.tv_alignment === 'center') lines.push('->alignCenter()');
                else if (field.tv_alignment === 'right') lines.push('->alignEnd()');
                
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
                    const jsonFormatter = `->formatStateUsing(function (?array \$state): ?string {
                    if (blank(\$state)) { return null; }
                    if (isset(\$state['${field.field_name}'])) { return \$state['${field.field_name}']; }
                    if (is_array(\$state) && isset(\$state[0]['${field.field_name}'])) { return implode(', ', array_column(\$state, '${field.field_name}')); }
                    return '';
                })`;
                    lines.push(jsonFormatter);
                }

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

            tableContent = tableContent.replace('<<ALL_COLUMNS>>', columnsCode.join(',\n                '));

            // --- FASA 3: PEMBERSIHAN ---
            tableContent = tableContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            tableContent = tableContent.replace(/<<.*?>>/g, '');

            const allUseStatements = tableContent.match(/use (.*?);/g) || [];
            let finalContent = tableContent;
            for (const useStmt of allUseStatements) {
                const match = useStmt.match(/use (?:.*\\)?(\w+)(?: as \w+)?;$/);
                if (match) {
                    const className = match[1];
                    const regex = new RegExp(`\\b${className}\\b`, 'g');
                    const occurrences = (finalContent.match(regex) || []).length;
                    if (occurrences <= 1) { 
                        finalContent = finalContent.replace(useStmt + '\n', '');
                    }
                }
            }
            tableContent = finalContent;

            const resourceFolder = modelNamePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Tables');
            fs.mkdirSync(outputFolderPath, { recursive: true });
            const outputFileName = `${modelNamePlural}Table.php`;
            const outputFilePath = path.join(outputFolderPath, outputFileName);
            fs.writeFileSync(outputFilePath, tableContent);
            console.log(`Table Class generated (Final): ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Table Classes (Final) generated successfully.' };
    } catch (error) {
        console.error('Failed to generate Filament Table Classes:', error);
        return { success: false, message: error.message };
    }
}

// Export functions untuk digunakan di main.js
module.exports = {
    generateFilamentTablesTable
};
