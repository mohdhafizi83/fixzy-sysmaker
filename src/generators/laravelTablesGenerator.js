// Filament Table class generator (Fixzy SysMaker).
// Builds table column code (media, relationships, formatting, inline edit,
// card layouts) and emits <Model>Table.php classes for tables/modules.
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
    toSingularCamelCase
} = require('../utils');
const { renderTemplate } = require('../render/engine');
const { labelPhp } = require('./localizationConfig');

/**
 * [HELPER] Clamp an integer setting server-side. Never trust the UI value.
 */
const clampInt = (v, min, max, dflt) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

/**
 * [HELPER] Escape a string for embedding in a generated single-quoted PHP
 * literal (backslashes first, then single quotes). Used by grid layout
 * expansion phase A (grouping / empty state / summaries).
 */
const escPhp = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/**
 * [HELPER] Decide whether a field can be rendered as an inline-editable
 * column in the grid. Only safe scalar types qualify; primary/auto-increment,
 * relationship lookups, calculated/algorithm and media fields are excluded.
 */
function isInlineEditableField(field, isRelationshipField) {
    if (field.primary_key === 1 || field.auto_increment === 1) return false;
    if (isRelationshipField) return false;
    if (field.calculated_enable === 1 || field.algorithm_enable === 1) return false;
    if (['image', 'upload', 'gmap', 'youtube', 'attachments'].includes(field.media_type)) return false;
    if (['rich_html', 'text_area'].includes(field.display_type)) return false;
    const dataType = String(field.data_type || '').toUpperCase();
    if (dataType === 'BOOLEAN') return true;
    if (field.display_type === 'options_list' && field.options_list_values) return true;
    const numericTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'];
    if (numericTypes.includes(dataType)) return true;
    const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];
    if (stringTypes.includes(dataType)) return true;
    return false;
}

/**
 * [HELPER] Build the PHP code for an inline-editable table column.
 * SECURITY: Filament's editable columns (Contracts\Editable) save WITHOUT
 * checking Laravel model policies — the generated updateStateUsing closure
 * therefore performs an explicit authorization check whenever the project
 * enables the Authorization module (Shield), and mirrors the field's
 * validation rules server-side.
 */
function buildInlineEditColumnPhp(field, fieldName, tableName, authorizationEnabled, localizationEnabled) {
    const dataType = String(field.data_type || '').toUpperCase();
    /** Escape single quotes for PHP literals. @param {*} s @returns {string} */
    const esc = (s) => String(s).replace(/'/g, "\\'");
    const lines = [];
    const authGuard = authorizationEnabled
        ? `// Match Filament resource authorization semantics: deny only when a\n                    // policy exists and denies. Raw Gate::can() denies when NO\n                    // policy exists, which 403'd every inline edit while the\n                    // resource's own canEdit() allowed it (grid audit 2026-09-30).\n                    if (\\Illuminate\\Support\\Facades\\Gate::getPolicyFor($record) && ! auth()->user()?->can('update', $record)) {\n                        abort(403);\n                    }\n                    `
        : '';
    /** Build the ->updateStateUsing(...) closure with optional auth guard. @param {string} cast cast expression applied to $state @returns {string} PHP closure code */
    const saveClosure = (cast) => `->updateStateUsing(function ($record, $state) {\n                    ${authGuard}if (is_null($state)) {\n                        $record->${field.field_name} = null;\n                    } else {\n                        $record->${field.field_name} = ${cast.replace('$state', '$state')};\n                    }\n                    $record->save();\n                    return $record;\n                })`;

    if (dataType === 'BOOLEAN') {
        lines.push(`ToggleColumn::make('${esc(fieldName)}')`);
        lines.push(`->label(${labelPhp(toTitleCase(field.caption || field.field_name), field, tableName, localizationEnabled)})`);
        lines.push(`->rules(['boolean'])`);
        lines.push(saveClosure('$state'));
    } else if (field.display_type === 'options_list' && field.options_list_values) {
        const options = field.options_list_values.split(';;').map((o) => `'${esc(o)}'`).join(', ');
        lines.push(`SelectColumn::make('${esc(fieldName)}')`);
        lines.push(`->label(${labelPhp(toTitleCase(field.caption || field.field_name), field, tableName, localizationEnabled)})`);
        lines.push(`->options([${options}])`);
        lines.push(`->rules(['in:${field.options_list_values.split(';;').map((o) => esc(o)).join(',')}'])`);
        lines.push(saveClosure('$state'));
    } else if (['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'].includes(dataType)) {
        lines.push(`TextInputColumn::make('${esc(fieldName)}')`);
        lines.push(`->label(${labelPhp(toTitleCase(field.caption || field.field_name), field, tableName, localizationEnabled)})`);
        lines.push(`->rules(['integer'])`);
        lines.push(saveClosure('(int) $state'));
    } else if (['DECIMAL', 'FLOAT', 'DOUBLE'].includes(dataType)) {
        lines.push(`TextInputColumn::make('${esc(fieldName)}')`);
        lines.push(`->label(${labelPhp(toTitleCase(field.caption || field.field_name), field, tableName, localizationEnabled)})`);
        lines.push(`->rules(['numeric'])`);
        lines.push(saveClosure('(float) $state'));
    } else {
        // String types
        lines.push(`TextInputColumn::make('${esc(fieldName)}')`);
        lines.push(`->label(${labelPhp(toTitleCase(field.caption || field.field_name), field, tableName, localizationEnabled)})`);
        const maxLen = clampInt(field.max_length || field.length, 1, 64000, 255);
        lines.push(`->rules(['max:${maxLen}'])`);
        lines.push(saveClosure('$state'));
    }
    // Common modifiers must apply to inline-edit columns too — the
    // editable branch returns early and previously dropped searchable,
    // so a field with enable_global_filter=1 + editable_in_tv=1 lost
    // search entirely (grid audit round 2, 2026-09-30).
    if (field.enable_global_filter === 1 && !field.enable_individual_filter) lines.push('->searchable()');
    if (!field.enable_global_filter && field.enable_individual_filter === 1) lines.push('->searchable(isIndividual: true, isGlobal: false)');
    if (field.enable_global_filter === 1 && field.enable_individual_filter === 1) lines.push('->searchable(isIndividual: true)');
    return lines.join('\n                    ');
}

/**
 * [HELPER] Generates the array of PHP column code strings.
 * Contains ALL original logic (Media, Relationships, Formatting, Summaries, etc).
 * Returns { all: string[], images: string[], others: string[] } so the caller can
 * wrap columns into a layout component based on the tv_template setting.
 */
function generateTableColumnsParts(tableData, relationships, tableName, projectSettings, modelNameSingular, tables) {
    const columnsCode = [];
    const imageColumns = [];
    const otherColumns = [];
    // B4: field_name -> generated column code, so column groups can re-wrap them.
    const fieldCodeMap = {};
    // D1: visible field names (dot-notation resolved) for split-view detail grid.
    const visibleFieldNames = [];
    // D1: TextEntry code per plain visible field for the split-view detail
    // schema. Dot-notation (relationship) fields are skipped because the
    // ViewAction fills the schema from $record->attributesToArray(), which
    // does not contain relationship data.
    const detailEntries = [];
    let inlineEditUsed = false;
    // Note: modelNameSingular is passed in as an argument (Module Name) for correct type hinting
    const localizationEnabled = require('./localizationConfig').isLocalizationEnabled(projectSettings);

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

    // Take visible fields and sort them by order
    // (This logic is used by the Standard Generator. Custom Module passes pre-manipulated tableData)
    const visibleFields = Object.values(tableData.fields)
        .filter(field => {
            // Sembunyikan Tenant FK dari pandangan table list secara automatik
            if (tenantFkField && field.field_name === tenantFkField) return false;
            
            return field.hide_in_tv !== 1;
        })
        .sort((a, b) => (a.field_order ?? 999) - (b.field_order ?? 999));

    for (const field of visibleFields) {
        // Inline edit (grid expansion 2026-09-25): when the table's grid
        // inline-edit option is OFF, editable_in_tv fields keep the legacy
        // behavior (skipped from the grid). When ON, safe scalar fields are
        // rendered as Filament editable columns instead.
        const inlineEditOn = tableData.grid_inline_edit === 1;
        if (field.editable_in_tv === 1 && !inlineEditOn) continue;
        let controller;
        if (field.media_type === 'image') controller = 'ImageColumn';
        else if (['upload', 'gmap', 'youtube'].includes(field.media_type) || field.data_type === 'BOOLEAN') controller = 'IconColumn';
        else controller = 'TextColumn';
        // Attachments: show a file count instead of raw JSON paths.
        const isAttachments = field.media_type === 'attachments';
        
        let fieldName;
        // Dot-notation logic for Relationships. The relation method on the model
        // is derived from the PARENT table's module_name (see getRelationFunctionName
        // in laravelDatabaseGenerator), so the column path must use the same
        // resolution — using the raw parent table name breaks whenever
        // module_name differs from the table name (e.g. fakulti -> faculty()).
        const fkRelationship = relationships.find(r => r.child_table_name === tableName && r.fk_child_field === field.field_name);
        if (fkRelationship) {
            let parentCamel;
            if (fkRelationship.parent_table_name === fkRelationship.child_table_name) {
                parentCamel = 'parent';
            } else if (tables && tables[fkRelationship.parent_table_name]) {
                const { getRelationFunctionName } = require('./laravelDatabaseGenerator');
                parentCamel = getRelationFunctionName(fkRelationship.parent_table_name, tables, false);
            } else {
                parentCamel = toSingularCamelCase(fkRelationship.parent_table_name);
            }
            
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
        visibleFieldNames.push(fieldName);
        if (!fieldName.includes('.')) {
            detailEntries.push(`\\Filament\\Infolists\\Components\\TextEntry::make('${escPhp(fieldName)}')->label(${labelPhp(toTitleCase(field.caption || field.field_name), field, tableName, localizationEnabled)})`);
        }

        // Inline-editable column path (replaces the read-only column entirely).
        if (field.editable_in_tv === 1 && inlineEditOn) {
            if (isInlineEditableField(field, !!fkRelationship)) {
                const editableCode = buildInlineEditColumnPhp(
                    field, fieldName, tableName,
                    Number(projectSettings && projectSettings.module_authorization) === 1,
                    localizationEnabled
                );
                columnsCode.push(editableCode);
                otherColumns.push(editableCode);
                fieldCodeMap[field.field_name] = editableCode;
                inlineEditUsed = true;
                continue;
            }
            // Field marked editable but not safe for inline edit: render read-only.
        }
        
        let lines = [`${controller}::make('${fieldName}')`];
        lines.push(`->label(${labelPhp(toTitleCase(field.caption || field.field_name), field, tableName, localizationEnabled)})`);
        if (isAttachments) {
            // Collapse the JSON array state into ONE count string BEFORE the
            // badge renders. Filament v5 ->badge() splits an array state into
            // one badge per element, so the old per-element formatStateUsing
            // produced "1 file 1 file" for a 2-file gallery (Fasa 20 audit).
            lines.push(`->getStateUsing(function ($record): ?string { $v = $record->${field.field_name}; $n = is_array($v) ? count($v) : (filled($v) ? 1 : 0); return $n === 0 ? null : ($n === 1 ? '1 file' : $n . ' files'); })`);
            lines.push(`->badge()`);
            lines.push(`->color('gray')`);
        }
        
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

        // A2: Summary row (grid layout expansion phase A). Only for plain
        // read-only TextColumns (not inline-editable, not image/icon) whose
        // data type is numeric. grid_summaries JSON: {"<field>": "sum|avg|count|min|max"}.
        if (controller === 'TextColumn' && !field.editable_in_tv && numericTypes.includes(field.data_type.toUpperCase())) {
            let summaryMap = {};
            try { summaryMap = JSON.parse(tableData.grid_summaries || '{}') || {}; } catch (e) { summaryMap = {}; }
            const agg = String(summaryMap[field.field_name] || '').toLowerCase();
            const cap = toTitleCase(field.caption || field.field_name);
            if (agg === 'sum') lines.push(`->summarize(\\Filament\\Tables\\Columns\\Summarizers\\Sum::make()->label('Total ${escPhp(cap)}'))`);
            else if (agg === 'avg') lines.push(`->summarize(\\Filament\\Tables\\Columns\\Summarizers\\Average::make()->label('Average ${escPhp(cap)}'))`);
            else if (agg === 'count') lines.push(`->summarize(\\Filament\\Tables\\Columns\\Summarizers\\Count::make()->label('Count of ${escPhp(cap)}'))`);
            else if (agg === 'min' || agg === 'max') lines.push(`->summarize(\\Filament\\Tables\\Columns\\Summarizers\\Range::make()->label('Range ${escPhp(cap)}'))`);
        }
        
        if (field.display_type === 'options_list' && field.options_list_values) {
            const options = field.options_list_values.split(';;');
            // Approval status field: use the workflow's configured badge colors.
            const apCfg = require('./approvalConfig').parseApprovalConfig(tableData);
            if (apCfg && field.field_name === apCfg.statusField) {
                const colorArms = apCfg.statuses
                    .map((s) => `        '${s.key.replace(/'/g, "\\'")}' => '${(s.color || 'gray').replace(/'/g, "\\'")}',`)
                    .join('\n');
                lines.push(`->badge()->color(fn (?string $state): string => match ($state) {\n${colorArms}\n        default => 'gray',\n        })`);
            } else if (options.length < 7) {
                const colors = ['gray', 'info', 'primary', 'warning', 'success', 'danger'];
                const matchArms = options.map((opt, i) => `        '${opt}' => '${colors[i % colors.length]}',`).join('\n');
                lines.push(`->badge()->color(fn (string \$state): string => match (\$state) {\n${matchArms}\n        })`);
            }
        }
        
if (field.data_type === 'JSON') {
            const jsonFormatter = `->formatStateUsing(function (array|string|null \$state): ?string {
            if (blank(\$state)) { return null; }
            
            // Safety net: if Eloquent returns a String (auto-cast failed), decode manually
            if (is_string(\$state)) {
                \$decoded = json_decode(\$state, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    \$state = \$decoded;
                } else {
                    return \$state; // Jika bukan JSON, pulangkan teks mentah
                }
            }
            
            // Process data verified to be an Array
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
        fieldCodeMap[field.field_name] = lines.join('\n                    ');
        if (controller === 'ImageColumn') imageColumns.push(lines.join('\n                    '));
        else otherColumns.push(lines.join('\n                    '));
    }

    // --- B4: Grouped column headers (native Filament ColumnGroup) ---
    // Capture the plain (pre-grouping) column list first: the multi-view
    // card variant (Phase C) needs plain columns wrapped in a Panel,
    // regardless of whether B4 grouping is active for the table view.
    const plainColumns = [...columnsCode];
    // grid_column_groups JSON: [{"label":"Contact","columns":["email","phone"]}, ...]
    // Only for the horizontal template (multi-level header bands don't make
    // sense inside card/panel layouts). Max 5 groups; a column can only be
    // in one group; unknown columns / unknown codes are skipped.
    let groupedUsed = false;
    const rawGroups = String(tableData.grid_column_groups || '').trim();
    if (rawGroups && String(tableData.tv_template || 'horizontal') === 'horizontal') {
        let groups = [];
        try { groups = JSON.parse(rawGroups); } catch (e) { groups = []; }
        if (Array.isArray(groups)) {
            const usedFields = new Set();
            const newColumns = [];
            let added = 0;
            for (const g of groups) {
                if (added >= 5) break;
                const label = String((g && g.label) || '').trim();
                const cols = Array.isArray(g && g.columns) ? g.columns : [];
                const codes = cols
                    .map((c) => String(c))
                    .filter((c) => fieldCodeMap[c] && !usedFields.has(c));
                if (!label || codes.length === 0) continue;
                codes.forEach((c) => usedFields.add(c));
                newColumns.push(`ColumnGroup::make('${escPhp(label)}', [\n${codes.map((c) => '                    ' + fieldCodeMap[c]).join(',\n')}\n                ])`);
                added++;
            }
            if (added > 0) {
                // Ungrouped visible columns keep their original relative order.
                const ungrouped = columnsCode.filter((code) => {
                    const owner = Object.keys(fieldCodeMap).find((k) => fieldCodeMap[k] === code);
                    return !(owner && usedFields.has(owner));
                });
                // Rebuild: groups first, then the remaining columns.
                columnsCode.length = 0;
                columnsCode.push(...newColumns, ...ungrouped);
                groupedUsed = true;
            }
        }
    }

    return { all: columnsCode, plain: plainColumns, images: imageColumns, others: otherColumns, visibleFieldNames, detailEntries, inlineEditUsed, groupedUsed };
}

/**
 * [HELPER] Phase D1 split view: clicking a row opens a WIDE slide-over
 * showing the record's fields in a 2-column detail grid (the plan's
 * "wide slide-over" split experience). Overrides the Phase A3 row-click
 * keys when active. Skipped when row-click is explicitly 'none' (user
 * wants no row interaction) or when there are no plain fields to show.
 *
 * Returns {} when inactive so the A3 values stand.
 */
function buildSplitViewContext(tableData, parts) {
    if (Number(tableData.grid_split_view) !== 1) return {};
    const rowClick = ['page', 'slideover', 'none'].includes(tableData.grid_row_click)
        ? tableData.grid_row_click : 'page';
    if (rowClick === 'none') return {};
    const entries = (parts && parts.detailEntries) || [];
    if (!entries.length) return {};
    const detailSchema = entries.map((e) => '                    ' + e).join(',\n');
    return {
        disabled_row_interaction: '->recordUrl(null)',
        record_action: "->recordAction('view')",
        action_view_slideover: 'ViewAction::make()'
            + "->slideOver()"
            + "->modalWidth('4xl')"
            + '->disabledSchema(false)'
            + '->schema([\\Filament\\Schemas\\Components\\Grid::make(2)->schema([\n'
            + detailSchema + '\n                ])]),',
    };
}

/**
 * [HELPER] Phase C multi-view switcher (table ⇄ card) for horizontal or
 * card templates. Emits a query-param-driven (?view=table|card) table:
 * the card variant reuses the existing Panel + contentGrid machinery with
 * the PLAIN (ungrouped) columns; the table variant uses the normal
 * (possibly B4-grouped) horizontal columns. A toolbar link toggles the
 * mode. Default = current behavior when grid_multi_view is off.
 *
 * Returns {} (no overrides) when the feature is not applicable.
 */
function buildMultiViewContext(tableData, parts, layout) {
    const enabled = Number(tableData.grid_multi_view) === 1;
    const tpl = String(tableData.tv_template || 'horizontal');
    if (!enabled || !['horizontal', 'card'].includes(tpl)) {
        return { multi_view: false, multi_view_columns: '', multi_view_toggle: '', multi_view_needs_panel_import: false };
    }
    const defaultView = tableData.grid_view_default === 'card' ? 'card' : 'table';
    const xl = clampInt(tableData.card_columns, 1, 6, 3);
    const md = clampInt(tableData.card_columns_tablet, 1, 2, 2);
    const isCard = `(request()->query('view', '${defaultView}')) === 'card'`;

    // Card variant: Panel-wrapped plain columns. If the base template is
    // already card, reuse its generated layout code; otherwise wrap now.
    const cardCols = (tpl === 'card' && layout.usesLayout)
        ? layout.code
        : `Panel::make([\n${parts.plain.map((c) => '                    ' + c).join(',\n')}\n                ])`;
    // Table variant: the normal horizontal columns (grouped if B4 active).
    const tableCols = parts.all.length
        ? `[\n${parts.all.map((c) => '                    ' + c).join(',\n')}\n                ]`
        : '[]';

    const multiViewColumns = `->columns(${isCard} ? [${cardCols}] : ${tableCols})`;
    const toggle =
        `Action::make('switchToTable')->link()->label('Table view')`
        + `->url(fn (): string => request()->fullUrlWithQuery(['view' => 'table']))`
        + `->hidden(fn (): bool => (request()->query('view', '${defaultView}')) === 'table'),\n                `
        + `Action::make('switchToCard')->link()->label('Card view')`
        + `->url(fn (): string => request()->fullUrlWithQuery(['view' => 'card']))`
        + `->hidden(fn (): bool => (request()->query('view', '${defaultView}')) === 'card'),`;

    return {
        multi_view: true,
        multi_view_columns: multiViewColumns,
        multi_view_toggle: toggle,
        multi_view_content_grid: `->contentGrid(${isCard} ? ['md' => ${md}, 'xl' => ${xl}] : null)`,
        multi_view_needs_panel_import: tpl !== 'card',
    };
}

/**
 * [HELPER] Backwards-compatible wrapper: returns the joined PHP columns string.
 */
function generateTableColumnsString(tableData, relationships, tableName, projectSettings, modelNameSingular, tables) {
    return generateTableColumnsParts(tableData, relationships, tableName, projectSettings, modelNameSingular, tables).all.join(',\n                ');
}

/**
 * [HELPER] Wraps the generated column code in the layout component that matches
 * the table's tv_template setting. Every template keeps all columns visible; only
 * the row layout differs.
 *
 *  - horizontal   (default) : flat columns, standard <table> rows
 *  - vertical_1             : one field per line  -> Panel( Stack(all) )
 *  - vertical_2             : two fields per line -> Panel( Grid(2, all) )
 *  - left_image             : image column left, remaining fields stacked right
 *                             -> Split( image, Stack(rest) )
 *  - right_image            : fields stacked left, image column right
 *                             -> Split( Stack(rest), image )
 *  - card                   : responsive card grid (handled via contentGrid +
 *                             a generated Blade card view; columns stay flat)
 *
 * If the template needs an image column but the table has none (or vice versa),
 * we gracefully fall back to the closest sensible layout.
 */
function buildColumnsLayout(tvTemplate, parts) {
    const tpl = String(tvTemplate || 'horizontal');
    const indent = '                '; // matches template's ->columns([ ... ]) body

    /** Indent and comma-join column code lines. @param {string[]} cols column code strings @returns {string} */
    const joinCols = (cols) => cols.map((c) => indent + '    ' + c).join(',\n');

    switch (tpl) {
        case 'vertical_1':
        case 'card':
            // 'card' reuses the vertical panel layout; the card GRID effect comes
            // from ->contentGrid() set in buildTableSettingsContext, which turns
            // each record (panel + actions) into one responsive grid cell.
            if (parts.all.length === 0) return { code: '', usesLayout: false };
            return {
                code: `Panel::make([\n${joinCols(parts.all)}\n${indent}])`,
                usesLayout: true,
                layoutImports: ['Filament\\Tables\\Columns\\Layout\\Panel'],
            };
        case 'vertical_2':
            if (parts.all.length === 0) return { code: '', usesLayout: false };
            return {
                code: `Grid::make(2, [\n${joinCols(parts.all)}\n${indent}])`,
                usesLayout: true,
                layoutImports: ['Filament\\Tables\\Columns\\Layout\\Grid'],
            };
        case 'left_image':
            if (parts.images.length === 0 || parts.others.length === 0) {
                // No image column (or nothing to pair it with): fall back to vertical_1.
                return buildColumnsLayout('vertical_1', parts);
            }
            return {
                code: `Split::make([\n${joinCols(parts.images)},\n${indent}    Stack::make([\n${parts.others.map((c) => indent + '        ' + c).join(',\n')}\n${indent}    ]),\n${indent}])->from('md')`,
                usesLayout: true,
                layoutImports: ['Filament\\Tables\\Columns\\Layout\\Split', 'Filament\\Tables\\Columns\\Layout\\Stack'],
            };
        case 'right_image':
            if (parts.images.length === 0 || parts.others.length === 0) {
                return buildColumnsLayout('vertical_1', parts);
            }
            return {
                code: `Split::make([\n${indent}    Stack::make([\n${parts.others.map((c) => indent + '        ' + c).join(',\n')}\n${indent}    ]),\n${joinCols(parts.images)}\n${indent}])->from('md')`,
                usesLayout: true,
                layoutImports: ['Filament\\Tables\\Columns\\Layout\\Split', 'Filament\\Tables\\Columns\\Layout\\Stack'],
            };
        default:
            return { code: '', usesLayout: false };
    }
}

/**
 * [HELPER] Build the settings context (actions, filters, header) for the
 * table template. Each key maps to one template variable.
 */
function buildTableSettingsContext(tableData, relationships, tableName, projectSettings, modelNameSingular) {
    const ctx = {};

    // CHILDREN COUNT & MODAL IFRAME LOGIC
    const childrenWithCount = relationships.filter(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
    if (childrenWithCount.length > 0) {
        const childImports = childrenWithCount.map(r => {
            const childSingular = toSingularPascalCase(r.child_table_name);
            const childResourceFolder = toPluralPascalCase(r.child_table_name);
            return `use App\\Filament\\Resources\\${childResourceFolder}\\${childSingular}Resource;`;
        }).join('\n');
        ctx.import_resources = childImports;

        const childPluralCamelNames = childrenWithCount.map(r => {
            const relName = r.parent_table_name === r.child_table_name ? 'children' : toPluralCamelCase(r.child_table_name);
            return `'${relName}'`;
        }).join(', ');
        ctx.function_show_count_in_tv = `\n    public static function getEloquentQuery(): Builder\n    {\n        return parent::getEloquentQuery()->withCount([${childPluralCamelNames}]);\n    }`;

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
            ctx.show_count_in_tv = showCountActions;
        } else {
            ctx.show_count_in_tv = '';
        }
    } else {
        ctx.import_resources = '';
        ctx.function_show_count_in_tv = '';
        ctx.show_count_in_tv = '';
    }

    // OTHER SETTINGS
    ctx.action_mass_delete = tableData.allow_mass_delete === 1
        ? 'BulkActionGroup::make([\n                DeleteBulkAction::make(),\n            ]),'
        : '';

    if (tableData.show_edit_button === 1 && tableData.enable_detail_view === 1) {
        ctx.disabled_row_interaction = '->recordUrl(null)';
        ctx.action_edit_button = tableData.dv_separate_page === 1
            ? 'EditAction::make()->openUrlInNewTab(),'
            : 'EditAction::make(),';
    } else {
        ctx.disabled_row_interaction = '';
        ctx.action_edit_button = '';
    }

    // Filament v5: paginationMode() requires the PaginationMode enum;
    // passing the raw string 'simple' throws TypeError at list-page load
    // (found via custom-module round-trip browser test).
    if (tableData.pagination_type === 'simple') ctx.pagination_type = "->paginationMode(\\Filament\\Tables\\Enums\\PaginationMode::Simple)";
    else if (tableData.pagination_type === 'extreme') ctx.pagination_type = '->extremePaginationLinks()';
    else ctx.pagination_type = '';

    // Card view: records render as a responsive grid of cards. Pagination
    // (e.g. 10 records per page) yields one card per record in the grid.
    // Card size = number of cards per row, configurable per table:
    //   card_columns         -> desktop (xl) cards per row (1-6, default 3)
    //   card_columns_tablet  -> tablet (md) cards per row (1-2, default 2)
    ctx.content_grid = '';
    if (String(tableData.tv_template || 'horizontal') === 'card') {
        /** Parse int and clamp to [min,max]; dflt when not finite. @param {*} v @param {number} min @param {number} max @param {number} dflt @returns {number} */
        const clampInt = (v, min, max, dflt) => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
        };
        const xl = clampInt(tableData.card_columns, 1, 6, 3);
        const md = clampInt(tableData.card_columns_tablet, 1, 2, 2);
        ctx.content_grid = `->contentGrid(['md' => ${md}, 'xl' => ${xl}])`;
    }

    ctx.add_description = tableData.table_description || '';

    ctx.action_delete_button = tableData.show_delete_button === 1 ? 'DeleteAction::make(),' : '';

    if (projectSettings.data_delete_type === 'soft') {
        ctx.action_restore_button = tableData.allow_restore_delete === 1 ? 'RestoreAction::make(),' : '';
        ctx.action_forcedelete_button = tableData.allow_force_delete === 1 ? 'ForceDeleteAction::make(),' : '';
        ctx.trashed_filter = (tableData.allow_restore_delete === 1 || tableData.allow_force_delete === 1) ? 'TrashedFilter::make(),' : '';
    } else {
        ctx.action_restore_button = '';
        ctx.action_forcedelete_button = '';
        ctx.trashed_filter = '';
    }

    ctx.disabled_pagination = tableData.allow_pagination === 0 ? '->paginated(false)' : '';

    // --- GRID EXPANSION (2026-09-25) ---
    // Column chooser: Filament shows it by default; only emit when disabled.
    ctx.column_manager = tableData.grid_column_manager === 0 ? '->columnManager(false)' : '';

    // Records-per-page choices (only meaningful when pagination is on).
    // Only emit when the owner actually changed from Filament's defaults
    // (options [5,10,25,50], default 10) so untouched tables stay identical.
    ctx.per_page = '';
    if (tableData.allow_pagination === 1) {
        const rawOpts = String(tableData.grid_per_page_options || '5,10,25,50');
        const opts = rawOpts
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => Number.isFinite(n) && n >= 1 && n <= 500);
        const def = clampInt(tableData.grid_default_per_page, 1, 500, 10);
        const optsChanged = JSON.stringify(opts) !== JSON.stringify([5, 10, 25, 50]);
        const defChanged = def !== 10;
        if (optsChanged || defChanged) {
            if (opts.length > 0) {
                const safeDef = opts.includes(def) ? def : opts[0];
                ctx.per_page = `->defaultPaginationPageOption(${safeDef})->paginationPageOptions([${opts.join(', ')}])`;
            } else {
                ctx.per_page = `->defaultPaginationPageOption(${def})`;
            }
        }
    }

    // Sticky header + row density: CSS-layer classes emitted per table.
    const gridClasses = [];
    if (tableData.grid_sticky_header === 1) gridClasses.push('fixzy-sticky-header');
    const density = ['compact', 'comfortable'].includes(tableData.grid_row_density) ? tableData.grid_row_density : 'normal';
    if (density !== 'normal') gridClasses.push(`fixzy-grid-${density}`);
    // B1: Zebra striping + border variant (CSS layer, FixzyGridServiceProvider).
    if (Number(tableData.grid_row_striping) === 1) gridClasses.push('fixzy-grid-striped');
    const borderStyle = ['minimal', 'none'].includes(String(tableData.grid_border_style || 'default'))
        ? String(tableData.grid_border_style) : 'default';
    if (borderStyle !== 'default') gridClasses.push(`fixzy-border-${borderStyle}`);
    // B2: Contained content width.
    const contentWidth = ['contained_1280', 'contained_1600'].includes(String(tableData.grid_content_width || 'full'))
        ? String(tableData.grid_content_width) : 'full';
    if (contentWidth !== 'full') gridClasses.push(`fixzy-grid-${contentWidth}`);
    // B3: Sticky toolbar / sticky pagination footer.
    if (Number(tableData.grid_sticky_toolbar) === 1) gridClasses.push('fixzy-sticky-toolbar');
    if (Number(tableData.grid_sticky_footer) === 1) gridClasses.push('fixzy-sticky-footer');
    ctx.grid_classes = gridClasses.length
        ? `->extraAttributes(['class' => '${gridClasses.join(' ')}'])`
        : '';

    // --- GRID LAYOUT EXPANSION PHASE A (2026-09-25) ---
    const isHorizontalTemplate = String(tableData.tv_template || 'horizontal') === 'horizontal';
    const fieldNamesList = Object.values(tableData.fields || {})
        .map((f) => f.field_name)
        .filter((n) => typeof n === 'string' && n !== '');

    // A1: Row grouping (native Filament CanGroupRecords). Horizontal template
    // only — layout templates pair columns differently and grouping on top of
    // them renders confusingly. Column must be a real field of this table.
    ctx.grouping = '';
    const groupBy = String(tableData.grid_group_by || '').trim();
    if (isHorizontalTemplate && groupBy && fieldNamesList.includes(groupBy)) {
        const dir = tableData.grid_group_direction === 'desc' ? 'desc' : 'asc';
        ctx.grouping = `->groups([\\Filament\\Tables\\Grouping\\Group::make('${escPhp(groupBy)}')])->defaultGroup('${escPhp(groupBy)}', '${dir}')`;
    }

    // A3: Row-click behavior. 'page' keeps the current behavior (emits
    // nothing extra). 'slideover' routes the row click to a slide-over
    // ViewAction; 'none' removes the row link entirely. Overrides the
    // edit-button row-interaction above when set to a non-default value.
    ctx.record_action = '';
    ctx.action_view_slideover = '';
    const rowClick = ['page', 'slideover', 'none'].includes(tableData.grid_row_click)
        ? tableData.grid_row_click
        : 'page';
    if (rowClick === 'slideover') {
        ctx.disabled_row_interaction = '->recordUrl(null)';
        ctx.record_action = "->recordAction('view')";
        ctx.action_view_slideover = 'ViewAction::make()->slideOver(),';
    } else if (rowClick === 'none') {
        ctx.disabled_row_interaction = '->recordUrl(null)';
    }

    // A4: Custom empty state. Heading is the switch; icon must be a valid
    // heroicon slug to avoid Filament rendering a broken icon reference.
    ctx.empty_state = '';
    const emptyHeading = String(tableData.grid_empty_heading || '').trim();
    if (emptyHeading) {
        let emptyChain = `->emptyStateHeading('${escPhp(emptyHeading)}')`;
        const emptyIcon = String(tableData.grid_empty_icon || '').trim();
        if (/^heroicon-[ocr]-[a-z0-9-]+$/.test(emptyIcon)) {
            emptyChain += `->emptyStateIcon('${emptyIcon}')`;
        }
        const emptyDesc = String(tableData.grid_empty_description || '').trim();
        if (emptyDesc) {
            emptyChain += `->emptyStateDescription('${escPhp(emptyDesc)}')`;
        }
        ctx.empty_state = emptyChain;
    }

    ctx.open_to_new_tab = tableData.dv_separate_page === 1 ? '->openRecordUrlInNewTab()' : '';
    ctx.disabled_detailview = tableData.enable_detail_view === 0 ? '->recordUrl(null)' : '';
    ctx.show_all_for_print = tableData.allow_print_view === 1
        ? `->when((bool) request()->query('print'), fn (Table \$table) => \$table->paginated(false),)`
        : '';

    return ctx;
}

/**
 * [UTAMA] Menjana fail Table Class standard.
 */
async function generateFilamentTablesTable(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;

        for (const tableName in tables) {
            if (tableName === 'users') continue;

            const tableData = tables[tableName];

            // ========================================================================
            // NAMING (MODULE NAME)
            // ========================================================================
            const nameSource = (tableData.module_name && tableData.module_name.trim() !== '')
                                ? tableData.module_name
                                : tableName;

            const modelNameSingular = toSingularPascalCase(nameSource); // StudentInfo
            const modelNamePlural = toPluralPascalCase(nameSource); // StudentInfos

            // 1. Generate columns + template-aware layout wrapper
            const parts = generateTableColumnsParts(tableData, relationships, tableName, projectSettings, modelNameSingular, tables);
            const layout = buildColumnsLayout(tableData.tv_template, parts);
            const columnsCode = layout.usesLayout
                ? layout.code
                : parts.all.join(',\n                ');

            // 2. Render template with settings context
            const apCfg = require('./approvalConfig').parseApprovalConfig(tableData);
            const multiView = buildMultiViewContext(tableData, parts, layout);
            let tableContent = renderTemplate('app/Filament/Resources/TablesTable.php.njk', {
                table_name_singular: modelNameSingular,
                table_name_plural: modelNamePlural,
                all_columns: columnsCode,
                inline_edit_used: !!parts.inlineEditUsed,
                layout_imports: (layout.layoutImports || [])
                    .concat(parts.groupedUsed ? ['Filament\\Tables\\Columns\\ColumnGroup'] : [])
                    .concat(multiView.multi_view && multiView.multi_view_needs_panel_import ? ['Filament\\Tables\\Columns\\Layout\\Panel'] : [])
                    .map((i) => `use ${i};`).join('\n'),
                approval_actions: apCfg ? "\n                " + require('./approvalConfig').approvalActionsPhp(apCfg, modelNameSingular) : '',
                ...buildTableSettingsContext(tableData, relationships, tableName, projectSettings, modelNameSingular),
                ...multiView,
                ...buildSplitViewContext(tableData, parts),
            });

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
 * [NEW] Generates a dedicated Table Class file for Custom Module.
 */
function generateSingleTableClass(basePath, resourceFolder, className, tableData, fullSchema, tableName) {
    const { project: projectSettings, database: { relationships, table: tables } } = fullSchema;

    // Custom Module uses the Standard Model (Module Name)
    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '')
                        ? tableData.module_name
                        : tableName;
    const modelNameSingular = toSingularPascalCase(nameSource);

    // The namespace for this table class is the custom folder
    // namespace App\Filament\Resources\PendingRegistrations\Tables;

    // 1. Render template (custom class name, custom namespace folder)
    const parts = generateTableColumnsParts(tableData, relationships, tableName, projectSettings, modelNameSingular, tables);
    const layout = buildColumnsLayout(tableData.tv_template, parts);
    const columnsCode = layout.usesLayout
        ? layout.code
        : parts.all.join(',\n                ');
    let tableContent = renderTemplate('app/Filament/Resources/TablesTable.php.njk', {
        table_name_singular: modelNameSingular,
        table_name_plural: resourceFolder, // Namespace uses the custom folder
        table_class_name: className,
        all_columns: columnsCode,
        inline_edit_used: !!parts.inlineEditUsed,
        layout_imports: (layout.layoutImports || []).concat(parts.groupedUsed ? ['Filament\\Tables\\Columns\\ColumnGroup'] : []).map((i) => `use ${i};`).join('\n'),
        approval_actions: (() => {
            const ap = require('./approvalConfig').parseApprovalConfig(tableData);
            return ap ? "\n                " + require('./approvalConfig').approvalActionsPhp(ap, modelNameSingular) : '';
        })(),
        ...buildTableSettingsContext(tableData, relationships, tableName, projectSettings, modelNameSingular),
    });

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

/**
 * Generate a Filament Table class per custom module (virtual fields from
 * settings_override applied on the base table).
 * @param {object} fullSchema assembled project schema
 * @param {string} basePath generated app root
 * @returns {Promise<{success: boolean, message: string}>}
 */
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
                            console.warn(`Failed to process table settings_override for module: ${moduleObj.module_name}`);
                        }
                    }

                    // --- BINA VIRTUAL TABLE DATA UNTUK CUSTOM MODULE ---
// ▼▼▼ PEMBAIKAN GENERATOR: SALIN DEFAULT DAHULU, KEMUDIAN OVERRIDE ▼▼▼
                    const virtualFields = {};
                    
                    // 1. Copy ALL fields from the original table (Default Module)
                    for (const [fName, fData] of Object.entries(tableData.fields)) {
                        virtualFields[fName] = { ...fData }; // Deep copy
                    }

                    // 2. Override with Custom Module-specific settings if present
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
                                        console.warn(`Failed to process settings_override for field: ${fieldName}`);
                                    }
                                }
                            }
                        });
                    }
                    // ▲▲▲ TAMAT PEMBAIKAN GENERATOR ▲▲▲

                    // Merge the table override into the table data
                    const virtualTableData = { 
                        ...tableData, 
                        ...tableOverrides,
                        fields: virtualFields, 
                        module_name: tableData.module_name // IMPORTANT: Preserve the original name reference for the Standard Model
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
    generateFilamentTablesCustomModules,
    // Reused by the RelationManager generator for child layout overrides (2026-09-26)
    generateTableColumnsParts,
    buildColumnsLayout
}