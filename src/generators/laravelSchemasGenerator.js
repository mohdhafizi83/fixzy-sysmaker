const fs = require('fs');
const path = require('path');

// IMPORT FUNGSI BANTUAN DARI UTILS
const { 
    toPluralPascalCase,
    toTitleCase,
    toSingularPascalCase,
    toSingularCamelCase,
    readTemplate
} = require('../utils');

/**
 * [HELPER] Menjana string schema untuk form. 
 * Mengandungi 100% logik ASAL + sokongan Custom View (readonly).
 */
function generateFormSchemaString(tableData, relationships, tableName, fullSchema) {
    const formFieldsCode = [];
    const modelNameSingular = toSingularPascalCase(tableName); // Kekal guna tableName untuk variable dalaman

    // Dapatkan medan yang visible & sort
    // LOGIK ASAL: filter visibleFields
    const visibleFields = Object.values(tableData.fields)
        .filter(field => {
            // Logik Custom View: Jika forced readonly, sentiasa paparkan
            if (field.is_forced_readonly) return true;
            // Jika tidak, ikut setting hide_in_dv
            return field.hide_in_dv !== 1;
        })
        .sort((a, b) => (a.field_order ?? 999) - (b.field_order ?? 999));

    for (const field of visibleFields) {
        
        // ============================================================
        // LOGIK 1: MEDAN STANDARD & HUBUNGAN (LINK)
        // ============================================================
        // KOD ASAL: if (field.media_type === 'link' ...
        // TERIMA 'link', kosong, atau null sebagai standard media (Text/Select/Date etc)
        const mediaType = field.media_type || ''; 
        const isStandardMedia = (mediaType === '' || mediaType === 'link');
        const isRepeater = ['repeater', 'repeater_simple'].includes(field.display_type);

        if (isStandardMedia && !isRepeater) {
            let fieldCode = `<<ELEMENT_TYPE>>::make('${field.field_name}')
    <<IS_EMAIL>>
    <<IS_NUMERIC>>
    <<IS_INTEGER>>
    <<IS_PASSWORD>>
    <<IS_PHONE>>
    <<IS_URL>>
    <<IS_READONLY>>
    <<IS_MIN_LENGTH>>
    <<IS_MAX_LENGTH>>
    <<IS_FIXED_LENGTH>>
    <<IS_MIN_VALUE>>
    <<IS_MAX_VALUE>>
    <<IS_REQUIRED>>
    <<IS_OFFAUTOCOMPLETE>>
    <<IS_PREFIX>>
    <<IS_SUFFIX>>
    <<SUFFIX_ICON_TEXT>>
    <<SUFFIX_COLORICON_TEXT>>
    <<IS_MASK>>
    <<IS_PLACEHOLDER>>
    <<IS_COLUMN_SPAN_FULL>>
    <<IS_UNIQUE>>
    <<IS_AUTOFOCUS>>
    <<IS_HELPER_TEXT>>
    <<IS_DEFAULT_VALUE>>
    <<IS_CAPTION>>
    <<IS_SEARCHABLE>>
    <<IS_PRELOAD>>
    <<OPTIONS_LIST_DROPDOWN>>
    <<DISABLED_EDIT_DROPDOWN_RELATIONSHIP>>
    <<IS_RELATIONSHIP_NORMAL>>
    <<PARENT_FIELDS_CAPTION>>
    <<IS_RELATIONSHIP_SELF_REF>>
    <<LINK_TO_PARENT_RECORD>>
    <<MULTIPLE_VALIDATION>>
    ->trim(),`;

            let elementType = 'TextInput'; 

            if (field.lookup_parent_table) {
                if (field.lookup_display_as === 'radios') {
                    elementType = 'Radio';
                } else {
                    elementType = 'Select';
                }
            } else {
                if (field.display_type === 'datetime_input') elementType = 'DatePicker'; 
                else if (field.display_type === 'text_area') elementType = 'Textarea'; 
                else if (field.display_type === 'rich_html') elementType = 'RichEditor'; 
                else if (field.display_type === 'check_box') elementType = 'Checkbox'; 
                else if (field.display_type === 'options_list') {
                    if (['dropdown', 'multi'].includes(field.options_display)) elementType = 'Select'; 
                    else if (field.options_display === 'radios') elementType = 'Radio'; 
                    else if (field.options_display === 'checkboxes') elementType = 'CheckboxList'; 
                }
            }
            
            fieldCode = fieldCode.replace('<<ELEMENT_TYPE>>', elementType);

            // Buang trim untuk jenis bukan teks
            if (['Select', 'Checkbox', 'Radio', 'CheckboxList', 'DatePicker', 'RichEditor'].includes(elementType)) {
                fieldCode = fieldCode.replace('->trim()', '');
            }

            // ... (SEMUA LOGIK PENGGANTIAN PLACEHOLDER DIKEKALKAN SEADANYA DARI KOD ASAL) ...
            if (field.display_type === 'text_input') {
                if (field.format_as === 'email') fieldCode = fieldCode.replace('<<IS_EMAIL>>', "->email()");
                else if (field.format_as === 'password') fieldCode = fieldCode.replace('<<IS_PASSWORD>>', "->password()->revealable()");
                else if (field.format_as === 'tel') fieldCode = fieldCode.replace('<<IS_PHONE>>', "->tel()->telRegex('/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\\s\\.\\/0-9]*$/')");
                else if (field.format_as === 'url') fieldCode = fieldCode.replace('<<IS_URL>>', "->url()");
                else if (field.format_as === 'custom' && field.format_mask) fieldCode = fieldCode.replace('<<IS_MASK>>', `->mask('${field.format_mask}')`);
            }

            if (field.display_type === 'text_input') {
                if (field.min_length && field.min_length === field.length) fieldCode = fieldCode.replace('<<IS_FIXED_LENGTH>>', `->length(${field.min_length})`);
                else {
                    if (field.min_length) fieldCode = fieldCode.replace('<<IS_MIN_LENGTH>>', `->minLength(${field.min_length})`);
                    if (field.length) fieldCode = fieldCode.replace('<<IS_MAX_LENGTH>>', `->maxLength(${field.length})`);
                }
            }

            if (field.display_type === 'text_input') {
                if (field.min_value) fieldCode = fieldCode.replace('<<IS_MIN_VALUE>>', `->minValue(${field.min_value})`);
                if (field.max_value) fieldCode = fieldCode.replace('<<IS_MAX_VALUE>>', `->maxValue(${field.max_value})`);
            }

            if (field.display_type === 'text_input') {
                if (field.read_only === 1) fieldCode = fieldCode.replace('<<IS_READONLY>>', "->readOnly()");
                if (field.required === 1) fieldCode = fieldCode.replace('<<IS_REQUIRED>>', "->required()->markAsRequired()");
                if (['INT', 'BIGINT'].includes(field.data_type)) fieldCode = fieldCode.replace('<<IS_INTEGER>>', "->integer()");
                if (field.data_type === 'DECIMAL') fieldCode = fieldCode.replace('<<IS_NUMERIC>>', "->numeric()");
                if (field.off_autocomplete === 1) fieldCode = fieldCode.replace('<<IS_OFFAUTOCOMPLETE>>', "->autocomplete(false)");
            }

            if (field.helper_text) fieldCode = fieldCode.replace('<<IS_HELPER_TEXT>>', `->helperText('${field.helper_text}')`);
            if (['text_input', 'text_area', 'rich_html'].includes(field.display_type) && field.placeholder) {
                fieldCode = fieldCode.replace('<<IS_PLACEHOLDER>>', `->placeholder('${field.placeholder}')`);
            }
            if (['text_area', 'rich_html'].includes(field.display_type) && field.column_span_full === 1) {
                fieldCode = fieldCode.replace('<<IS_COLUMN_SPAN_FULL>>', "->columnSpanFull()");
            }

            if (field.unique === 1) fieldCode = fieldCode.replace('<<IS_UNIQUE>>', "->unique(ignoreRecord: true)");
            if (field.default_value) fieldCode = fieldCode.replace('<<IS_DEFAULT_VALUE>>', `->default('${field.default_value}')`);
            fieldCode = fieldCode.replace('<<IS_CAPTION>>', `->label('${field.caption || toTitleCase(field.field_name)}')`);

            if (field.display_type === 'options_list') {
                if (field.data_type !== 'BOOLEAN') {
                    let optionsCode = '';
                    if (field.options_display === 'multi') optionsCode += "->multiple()\n";
                    if (field.options_list_values) {
                        const optionsArr = field.options_list_values.split(';;').map(opt => `'${opt}' => '${toTitleCase(opt)}'`).join(', ');
                        optionsCode += `->options([${optionsArr}])`;
                    } else {
                        optionsCode += `->options([])`;
                    }
                    fieldCode = fieldCode.replace('<<OPTIONS_LIST_DROPDOWN>>', optionsCode);
                } else {
                    const trueLabel = field.boolean_label_true || 'True';
                    const falseLabel = field.boolean_label_false || 'False';
                     fieldCode = fieldCode.replace('<<OPTIONS_LIST_DROPDOWN>>', ``); 
                }
            }

            if (field.lookup_parent_table) {
                const parentTable = field.lookup_parent_table;
                const caption1 = field.lookup_caption_1;
                
                // UPDATE: Guna Module Name Parent untuk nama relationship (CamelCase)
                const parentTableData = fullSchema.database.table[parentTable];
                const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                                        ? parentTableData.module_name
                                        : parentTable;
                const relationshipName = toSingularCamelCase(parentNameSource);

                if (parentTable === tableName) { 
                    const parentIdField = 'id';
                    const selfRefCode = `->relationship(\n    name: 'parent',\n    titleAttribute: '${caption1}',\n    modifyQueryUsing: fn (Builder $query, ?Model $record) => $query->where('${parentIdField}', '!=', $record?->${parentIdField})\n)`;
                    fieldCode = fieldCode.replace('<<IS_RELATIONSHIP_SELF_REF>>', selfRefCode);
                } else {
                    fieldCode = fieldCode.replace('<<IS_RELATIONSHIP_NORMAL>>', `->relationship('${relationshipName}', '${caption1}')`);
                }

                if (field.lookup_caption_2) {
                    const caption2 = field.lookup_caption_2;
                    const separator = field.lookup_separator || ' ';
                    fieldCode = fieldCode.replace('<<PARENT_FIELDS_CAPTION>>', `->getOptionLabelFromRecordUsing(fn (Model $record) => "{$record->${caption1}} ${separator} {$record->${caption2}}")`);
                }

                const parentRelation = relationships.find(r => r.child_table_name === tableName && r.fk_child_field === field.field_name);
                if (parentRelation && parentRelation.show_count_in_tv === 1) {
                    fieldCode = fieldCode.replace('<<DISABLED_EDIT_DROPDOWN_RELATIONSHIP>>', `->disabled(session('foreignkey') === '${field.field_name}')`);
                }

                if (field.lookup_searchable === 1) fieldCode = fieldCode.replace('<<IS_SEARCHABLE>>', "->searchable()");
                if (field.lookup_preload === 1) fieldCode = fieldCode.replace('<<IS_PRELOAD>>', "->preload()");

                if (field.lookup_link_behavior === 'modal') {
                    // UPDATE: Guna Module Name untuk Resource URL
                    const parentResourceSingular = toSingularPascalCase(parentNameSource);
                    
                    const suffixActionCode = `->suffixActions([
    Action::make('view_${parentTable}')
        ->icon('heroicon-o-eye')
        ->modalContent(fn (Get $get): ?View => $get('${field.field_name}') ? view('filament.components.modal-iframe', ['src' => ${parentResourceSingular}Resource::getUrl('edit', ['record' => $get('${field.field_name}')]) . '?iframe=1']) : null)
        ->modalWidth('6xl')
        ->modalSubmitAction(false)
        ->hidden(fn (Get $get): bool => !$get('${field.field_name}')),

    Action::make('create_${parentTable}')
        ->icon('heroicon-o-plus')
        ->modalContent(fn (): View => view('filament.components.modal-iframe', ['src' => ${parentResourceSingular}Resource::getUrl('create') . '?iframe=1']))
        ->modalWidth('6xl')
        ->modalSubmitAction(false),
])`;
                    fieldCode = fieldCode.replace('<<LINK_TO_PARENT_RECORD>>', suffixActionCode);
                }
            }

            if (field.display_type === 'text_input') {
                if (field.prefix) fieldCode = fieldCode.replace('<<IS_PREFIX>>', `->prefix('${field.prefix}')`);
                if (field.suffix) fieldCode = fieldCode.replace('<<IS_SUFFIX>>', `->suffix('${field.suffix}')`);
                if (field.suffix_icon) fieldCode = fieldCode.replace('<<SUFFIX_ICON_TEXT>>', `->suffixIcon('heroicon-o-${field.suffix_icon}')`);
                if (field.suffix_icon_color) fieldCode = fieldCode.replace('<<SUFFIX_COLORICON_TEXT>>', `->suffixIconColor('${field.suffix_icon_color}')`);
            }

            if (elementType === 'Select') {
                fieldCode = fieldCode.replace('->integer()', '');
            }

            // MULTIPLE VALIDATION RULES (LOGIK ASAL)
            let multiValCode = '';
            if (field.validations && Array.isArray(field.validations)) {
                field.validations.forEach(val => {
                    const type = val.rule_type;
                    const v1 = val.rule_value_1;
                    const v2 = val.rule_value_2;

                    const toPhpArray = (str) => {
                        if (!str) return "[]";
                        const items = str.split(',').map(s => `'${s.trim()}'`).join(', ');
                        return `[${items}]`;
                    };

                    if (type === 'string') multiValCode += "->string()";
                    else if (type === 'alpha') multiValCode += "->alpha()";
                    else if (type === 'alpha_dash') multiValCode += "->alphaDash()";
                    else if (type === 'alpha_num') multiValCode += "->alphaNum()";
                    else if (type === 'ascii') multiValCode += "->ascii()";
                    else if (type === 'active_url') multiValCode += "->activeUrl()";
                    else if (type === 'ip') multiValCode += "->ip()";
                    else if (type === 'ipv4') multiValCode += "->ipv4()";
                    else if (type === 'ipv6') multiValCode += "->ipv6()";
                    else if (type === 'mac_address') multiValCode += "->macAddress()";
                    else if (type === 'hex_color') multiValCode += "->hexColor()";
                    else if (type === 'json') multiValCode += "->json()";
                    else if (type === 'ulid') multiValCode += "->ulid()";
                    else if (type === 'uuid') multiValCode += "->uuid()";
                    else if (type === 'same') multiValCode += `->same('${v1}')`;
                    else if (type === 'different') multiValCode += `->different('${v1}')`;
                    else if (type === 'gt') multiValCode += `->gt('${v1}')`;
                    else if (type === 'gte') multiValCode += `->gte('${v1}')`;
                    else if (type === 'lt') multiValCode += `->lt('${v1}')`;
                    else if (type === 'lte') multiValCode += `->lte('${v1}')`;
                    else if (type === 'after') multiValCode += `->after('${v1}')`;
                    else if (type === 'after_or_equal') multiValCode += `->afterOrEqual('${v1}')`;
                    else if (type === 'before') multiValCode += `->before('${v1}')`;
                    else if (type === 'before_or_equal') multiValCode += `->beforeOrEqual('${v1}')`;
                    else if (type === 'in') multiValCode += `->in(${toPhpArray(v1)})`;
                    else if (type === 'not_in') multiValCode += `->notIn(${toPhpArray(v1)})`;
                    else if (type === 'starts_with') multiValCode += `->startsWith(${toPhpArray(v1)})`;
                    else if (type === 'doesnt_start_with') multiValCode += `->doesntStartWith(${toPhpArray(v1)})`;
                    else if (type === 'ends_with') multiValCode += `->endsWith(${toPhpArray(v1)})`;
                    else if (type === 'doesnt_end_with') multiValCode += `->doesntEndWith(${toPhpArray(v1)})`;
                    else if (type === 'regex') multiValCode += `->regex('${v1}')`;
                    else if (type === 'not_regex') multiValCode += `->notRegex('${v1}')`;
                    else if (type === 'multiple_of') multiValCode += `->multipleOf('${v1}')`;
                    else if (type === 'required_if') multiValCode += `->requiredIf('${v1}', '${v2}')`;
                    else if (type === 'required_unless') multiValCode += `->requiredUnless('${v1}', '${v2}')`;
                    else if (type === 'required_with') multiValCode += `->requiredWith('${v1}')`;
                    else if (type === 'required_with_all') multiValCode += `->requiredWithAll('${v1}')`;
                    else if (type === 'required_without') multiValCode += `->requiredWithout('${v1}')`; 
                    else if (type === 'required_without_all') multiValCode += `->requiredWithoutAll('${v1}')`;
                    else if (type === 'required_if_accepted') multiValCode += `->requiredIfAccepted('${v1}')`;
                    else if (type === 'prohibited') multiValCode += "->prohibited()";
                    else if (type === 'prohibited_if') multiValCode += `->prohibitedIf('${v1}', '${v2}')`;
                    else if (type === 'prohibited_unless') multiValCode += `->prohibitedUnless('${v1}', '${v2}')`;
                    else if (type === 'prohibits') multiValCode += `->prohibits(${toPhpArray(v1)})`;
                    else if (type === 'exists') multiValCode += "->exists()";
                });
            }
            fieldCode = fieldCode.replace('<<MULTIPLE_VALIDATION>>', multiValCode);

            // --- TAMBAHAN UNTUK CUSTOM VIEW: FORCED READONLY ---
            if (field.is_forced_readonly) {
                if (fieldCode.trim().endsWith(',')) {
                    fieldCode = fieldCode.trim().slice(0, -1) + "->disabled()->dehydrated(false),";
                } else {
                    fieldCode += "->disabled()->dehydrated(false)";
                }
            }

            fieldCode = fieldCode.replace(/<<.*?>>/g, '');
            fieldCode = fieldCode.replace(/^\s*[\r\n]/gm, '');
            formFieldsCode.push(fieldCode);
        }

        // ============================================================
        // LOGIK 2: MEDIA (IMAGE, UPLOAD, MAP, YOUTUBE)
        // ============================================================
        else if (field.media_type === 'image') {
            const kebabFieldName = field.field_name.replace(/_/g, '-');
            let imageCode = `FileUpload::make('${field.field_name}')
    ->label('${field.caption || toTitleCase(field.field_name)}')
    ->image()
    <<IMAGE_SHARP>>
    ->imageEditor()
    ->directory('${kebabFieldName}')
    ->disk('${field.image_storage_provider || 'public'}')
    ->downloadable(),`;

            if (field.dv_thumb_shape === 'circular') {
                imageCode = imageCode.replace('<<IMAGE_SHARP>>', '->avatar()->circleCropper()');
            } else {
                imageCode = imageCode.replace('<<IMAGE_SHARP>>', '');
            }
            
            if (field.is_forced_readonly) {
                 imageCode = imageCode.replace(',', '->disabled()->dehydrated(false),');
            }

            imageCode = imageCode.replace(/<<.*?>>/g, '').replace(/^\s*[\r\n]/gm, '');
            formFieldsCode.push(imageCode);
        }

        else if (field.media_type === 'upload') {
            const kebabFieldName = field.field_name.replace(/_/g, '-');
            let acceptedTypes = '';
            if (field.file_types) {
                acceptedTypes = field.file_types.split(',').map(t => `'${t.trim()}'`).join(', ');
            }
            let uploadCode = `FileUpload::make('${field.field_name}')
    ->label('${field.caption || toTitleCase(field.field_name)}')
    ->directory('${kebabFieldName}')
    ->disk('${field.file_storage_provider || 'public'}')
    ->acceptedFileTypes([${acceptedTypes}])
    ->downloadable()
    ->openable(),`;
            
            if (field.is_forced_readonly) {
                 uploadCode = uploadCode.replace(',', '->disabled()->dehydrated(false),');
            }

            uploadCode = uploadCode.replace(/<<.*?>>/g, '').replace(/^\s*[\r\n]/gm, '');
            formFieldsCode.push(uploadCode);
        }

        else if (['gmap', 'youtube'].includes(field.media_type)) {
            const viewerType = field.media_type === 'gmap' ? 'map' : 'video';
            let mediaViewCode = `TextInput::make('${field.field_name}')
    ->label('${field.caption || toTitleCase(field.field_name)}')
    ->columnSpanFull(),
ViewField::make('${field.field_name}')
    ->view('filament.forms.components.${viewerType}-viewer')
    ->columnSpanFull(),`;
            mediaViewCode = mediaViewCode.replace(/<<.*?>>/g, '').replace(/^\s*[\r\n]/gm, '');
            formFieldsCode.push(mediaViewCode);
        }

        // ============================================================
        // LOGIK 3: REPEATER (SIMPLE & COMPLEX)
        // ============================================================
        else if (field.display_type === 'repeater_simple') {
            const elementType = field.repeater_simple_display_as === 'dropdown_list' ? 'Select' : 'TextInput';
            let elementCode = `${elementType}::make('${field.field_name}')`;
            
            if (field.repeater_simple_display_as === 'text_input') {
                if (field.repeater_simple_format_as === 'email') elementCode += "->email()";
                if (field.repeater_simple_format_as === 'url') elementCode += "->url()";
                if (field.repeater_simple_format_as === 'password') elementCode += "->password()->revealable()";
                if (field.repeater_simple_format_as === 'tel') elementCode += "->tel()->telRegex('/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\\s\\.\\/0-9]*$/')";
            }
            
            if (field.repeater_simple_required === 1) elementCode += "->required()";
            
            if (field.repeater_simple_display_as === 'dropdown_list' && field.repeater_simple_list_values) {
                const optionsArr = field.repeater_simple_list_values.split(';;').map(opt => `'${opt}' => '${toTitleCase(opt)}'`).join(', ');
                elementCode += `->options([${optionsArr}])`;
            }

            let repeaterCode = `Repeater::make('${field.field_name}')
    ->label('${field.caption || toTitleCase(field.field_name)}')
    ->simple(
        ${elementCode}->unique(ignoreRecord: true),
    )
    ->reorderable(false),`;
            
            if (field.is_forced_readonly) {
                 repeaterCode = repeaterCode.replace(',', '->disabled()->dehydrated(false),');
            }

            formFieldsCode.push(repeaterCode);
        }

        else if (field.display_type === 'repeater') {
            let schemaElements = [];
            
            for (let i = 1; i <= 3; i++) {
                const displayAs = field[`repeater_${i}_display_as`];
                if (!displayAs) continue; 

                const subFieldName = `${field.field_name}_${i}`; 

                const elementType = displayAs === 'dropdown_list' ? 'Select' : 'TextInput';
                let elementCode = `${elementType}::make('${subFieldName}')\n            ->label('Item ${i}')`;

                if (displayAs === 'text_input') {
                    const formatAs = field[`repeater_${i}_format_as`];
                    if (formatAs === 'email') elementCode += "->email()";
                    if (formatAs === 'url') elementCode += "->url()";
                    if (formatAs === 'password') elementCode += "->password()->revealable()";
                    if (formatAs === 'tel') elementCode += "->tel()->telRegex('/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\\s\\.\\/0-9]*$/')";
                }

                if (field[`repeater_${i}_required`] === 1) elementCode += "->required()";

                if (displayAs === 'dropdown_list') {
                     const listValues = field[`repeater_${i}_list_values`];
                     if (listValues) {
                        const optionsArr = listValues.split(';;').map(opt => `'${opt}' => '${toTitleCase(opt)}'`).join(', ');
                        elementCode += `->options([${optionsArr}])`;
                     } else {
                        elementCode += `->options([])`;
                     }
                }
                schemaElements.push(elementCode + ',');
            }

            let repeaterCode = `Repeater::make('${field.field_name}')
    ->label('${field.caption || toTitleCase(field.field_name)}')
    ->schema([
        ${schemaElements.join('\n        ')}
    ])
    ->reorderable(false),`;
            
            if (field.is_forced_readonly) {
                 repeaterCode = repeaterCode.replace(',', '->disabled()->dehydrated(false),');
            }

            formFieldsCode.push(repeaterCode);
        }
    } // Tamat loop fields

    return formFieldsCode.join('\n                ');
}

/**
 * [FUNGSI UTAMA] Menjana fail Form Schema untuk Resources standard.
 */
async function generateFilamentSchemasForm(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/SchemasForm.template');

        for (const tableName in tables) {
            if (tableName === 'users') continue;

            let formContent = templateContent;
            const tableData = tables[tableName];
            
            // ========================================================================
            // LOGIK PENAMAAN BARU (MODULE NAME)
            // ========================================================================
            const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                                ? tableData.module_name 
                                : tableName;

            const modelNameSingular = toSingularPascalCase(nameSource); // StudentInfo
            const modelNamePlural = toPluralPascalCase(nameSource); // StudentInfos

            formContent = formContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);
            formContent = formContent.replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);

            let importResources = new Set();

            // Scan fields for imports
            Object.values(tableData.fields).forEach(f => {
                if (f.lookup_parent_table && f.lookup_link_behavior === 'modal') {
                    const parentTableData = tables[f.lookup_parent_table];
                    const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                                            ? parentTableData.module_name
                                            : f.lookup_parent_table;
                    
                    const parentSingular = toSingularPascalCase(parentNameSource);
                    const parentFolder = toPluralPascalCase(parentNameSource);
                    importResources.add(`use App\\Filament\\Resources\\${parentFolder}\\${parentSingular}Resource;`);
                }
            });
            
            formContent = formContent.replace('<<IMPORT_RESOURCES>>', Array.from(importResources).join('\n'));

            // LOGIK GRID (SAMA SEPERTI ASAL)
            const gridType = tableData.column_grid_type || 'dynamic';
            if (gridType === 'static') {
                const columns = parseInt(tableData.static_grid_columns) || 2;
                let grid2 = '';
                let grid3 = '';
                if (columns === 2) { grid2 = "'md' => 2,"; } 
                else if (columns === 3) { grid2 = "'md' => 2,"; grid3 = "'xl' => 3,"; }
                
                const staticGridCode = `->columns([
        'default' => 1,
        ${grid2}
        ${grid3}
    ])`;
                formContent = formContent.replace('<<GRID_COLUMN_CONTROL>>', staticGridCode);
            } else {
                const dynamicGridCode = `->columns(fn (Page $livewire) => $livewire->gridColumns)
    ->headerActions([
        Action::make('1 Kolum')
            ->icon('heroicon-o-queue-list')
            ->iconButton()
            ->color('gray')
            ->tooltip('Display 1 column')
            ->action(fn (Page $livewire) => $livewire->gridColumns = 1),

        Action::make('2 Kolum')
            ->icon('heroicon-o-view-columns')
            ->iconButton()
            ->color('gray')
            ->tooltip('Display 2 column')
            ->action(fn (Page $livewire) => $livewire->gridColumns = 2),

        Action::make('3 Kolum')
            ->icon('heroicon-o-table-cells')
            ->iconButton()
            ->color('gray')
            ->tooltip('Display 3 column')
            ->action(fn (Page $livewire) => $livewire->gridColumns = 3),
    ])`;
                formContent = formContent.replace('<<GRID_COLUMN_CONTROL>>', dynamicGridCode);
            }

            formContent = formContent.replace('<<DETAIL_VIEW_TITLE>>', tableData.detail_view_title || '');

            // Jana Form Fields (Pass fullSchema untuk lookup module_name)
            const formFieldsString = generateFormSchemaString(tableData, relationships, tableName, fullSchema);
            formContent = formContent.replace('<<ALL_COLUMNS_FORM>>', formFieldsString);

            // Clean Up & Save
            formContent = formContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '').replace(/<<.*?>>/g, '');

            const allUseStatements = formContent.match(/use (.*?);/g) || [];
            let finalContent = formContent;
            
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
            formContent = finalContent;

            const resourceFolder = modelNamePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Schemas');
            fs.mkdirSync(outputFolderPath, { recursive: true });
            
            const outputFilePath = path.join(outputFolderPath, `${modelNameSingular}Form.php`);
            fs.writeFileSync(outputFilePath, formContent);
            console.log(`Form Schema generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Form Schemas generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * [HELPER] Menjana satu fail Schema Class (untuk Custom View).
 */
function generateSingleSchemaClass(basePath, resourceFolder, className, tableData, fullSchema, tableName) {
    const { project: projectSettings, database: { relationships } } = fullSchema;
    const templateContent = readTemplate('app/Filament/Resources/SchemasForm.template');
    
    // Gunakan Module Name untuk Model
    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                        ? tableData.module_name 
                        : tableName;
    const modelNameSingular = toSingularPascalCase(nameSource); 
    
    let formContent = templateContent
        .replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular)
        .replace(/<<TABLE_NAME_PLURAL>>/g, resourceFolder); // Namespace guna custom folder

    // Override Class Name
    formContent = formContent.replace(/class\s+\w+Form/, `class ${className}`);

    // Import Resources (Copy logic from main function)
    let importResources = new Set();
    Object.values(tableData.fields).forEach(f => {
        if (f.lookup_parent_table && f.lookup_link_behavior === 'modal') {
            const parentTableData = fullSchema.database.table[f.lookup_parent_table];
            const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                                    ? parentTableData.module_name
                                    : f.lookup_parent_table;
            
            const parentSingular = toSingularPascalCase(parentNameSource);
            const parentFolder = toPluralPascalCase(parentNameSource);
            importResources.add(`use App\\Filament\\Resources\\${parentFolder}\\${parentSingular}Resource;`);
        }
    });
    formContent = formContent.replace('<<IMPORT_RESOURCES>>', Array.from(importResources).join('\n'));

    // Grid Default untuk Custom View (Dynamic)
    const dynamicGridCode = `->columns(fn (Page $livewire) => $livewire->gridColumns ?? 2)`;
    formContent = formContent.replace('<<GRID_COLUMN_CONTROL>>', dynamicGridCode);
    
    // Tajuk Borang
    formContent = formContent.replace('<<DETAIL_VIEW_TITLE>>', tableData.table_view_title || '');

    // Jana Fields
    const formFieldsString = generateFormSchemaString(tableData, relationships, tableName, fullSchema);
    formContent = formContent.replace('<<ALL_COLUMNS_FORM>>', formFieldsString);

    // Clean Up
    formContent = formContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '').replace(/<<.*?>>/g, '');

    // --- IMPORT CLEANUP FOR CUSTOM VIEW (Rules #1) ---
    const allUseStatements = formContent.match(/use (.*?);/g) || [];
    let finalContent = formContent;
    
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

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Schemas');
    if (!fs.existsSync(outputFolderPath)) fs.mkdirSync(outputFolderPath, { recursive: true });
    
    fs.writeFileSync(path.join(outputFolderPath, `${className}.php`), finalContent);
    console.log(`   - Form Schema generated: ${className}.php`);
}

/**
 * [BARU] Menjana Form Schema untuk SEMUA Custom Views.
 */
async function generateFilamentSchemasCustomViews(fullSchema, basePath) {
    try {
        const { database: { table: tables } } = fullSchema;
        let count = 0;

        for (const tableName in tables) {
            const tableData = tables[tableName];
            if (tableData.custom_views && tableData.custom_views.length > 0) {
                for (const view of tableData.custom_views) {
                    const viewNameClean = view.view_name.replace(/[^a-zA-Z0-9]/g, '');
                    const viewSafeNamePlural = toPluralPascalCase(viewNameClean);
                    const viewSafeNameSingular = toSingularPascalCase(viewNameClean);
                    const schemaClassName = `${viewSafeNameSingular}Form`; 

                    // Bina Virtual Fields (Readonly Logic)
                    const virtualFields = {};
                    const selectedFields = view.fields || []; 
                    
                    selectedFields.forEach(f => {
                        const fieldName = f.sourceName || f.field_source_name;
                        const originalField = tableData.fields[fieldName];
                        if (originalField) {
                            virtualFields[fieldName] = { ...originalField };
                            if (f.isReadonly === true || f.is_readonly === 1) {
                                virtualFields[fieldName].is_forced_readonly = true;
                            }
                        }
                    });
                    
                    // Perlu pass 'module_name' original supaya helper tahu nama Model
                    const virtualTableData = { 
                        ...tableData, 
                        fields: virtualFields, 
                        table_view_title: view.view_name,
                        module_name: tableData.module_name // PENTING: Kekalkan module_name asal
                    };

                    generateSingleSchemaClass(
                        basePath,
                        viewSafeNamePlural,    // resourceFolder
                        schemaClassName, // className
                        virtualTableData,
                        fullSchema,
                        tableName
                    );
                    count++;
                }
            }
        }
        return { success: true, message: `${count} Custom View Schemas generated.` };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// KEMASKINI EXPORT
module.exports = {
    generateFilamentSchemasForm,
    generateSingleSchemaClass,
    generateFormSchemaString,
    generateFilamentSchemasCustomViews
};