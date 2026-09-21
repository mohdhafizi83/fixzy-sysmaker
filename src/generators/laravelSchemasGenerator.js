const fs = require('fs');
const path = require('path');

// IMPORT FUNGSI BANTUAN DARI UTILS
const { 
    toPluralPascalCase,
    toTitleCase,
    toSingularPascalCase,
    toSingularCamelCase
} = require('../utils');
const { renderTemplate } = require('../render/engine');
const { buildFormFieldContext } = require('./fieldContext');

/**
 * [HELPER] Generates the schema string for a form. 
 * Mengandungi 100% logik ASAL + sokongan Custom Module (readonly).
 */
function generateFormSchemaString(tableData, relationships, tableName, fullSchema) {
    const formFieldsCode = [];
    const modelNameSingular = toSingularPascalCase(tableName); // Keep using tableName for the internal variable

    // --- MULA: LOGIK PENGESANAN TENANT FK ---
    const projectSettings = fullSchema.project || {};
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
    // --- TAMAT LOGIK PENGESANAN TENANT FK ---

    // Get visible & sorted fields
    // LOGIK ASAL: filter visibleFields
    const visibleFields = Object.values(tableData.fields)
        .filter(field => {
            // Sembunyikan Tenant FK dari pandangan form secara automatik
            if (tenantFkField && field.field_name === tenantFkField) return false;

            // Logik Custom Module: Jika forced readonly, sentiasa paparkan
            if (field.is_forced_readonly) return true;
            // Otherwise, follow the hide_in_dv setting
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
            // Resolve element type (Filament component)
            let elementType = 'TextInput';
            if (field.lookup_parent_table) {
                if (field.lookup_display_as === 'radios') elementType = 'Radio';
                else elementType = 'Select';
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

            // Build render context for the field template
            let parentOpts = {};
            if (field.lookup_parent_table) {
                const parentTable = field.lookup_parent_table;
                const parentTableData = fullSchema.database.table[parentTable];
                const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                                        ? parentTableData.module_name
                                        : parentTable;
                parentOpts = {
                    parentTable,
                    isSelfRef: parentTable === tableName,
                    relationshipName: toSingularCamelCase(parentNameSource),
                    parentResourceSingular: toSingularPascalCase(parentNameSource),
                    parentRelation: relationships.find(r => r.child_table_name === tableName && r.fk_child_field === field.field_name),
                };
            }

            const ctx = buildFormFieldContext(field, elementType, parentOpts);
            // Legacy cleanup: drop blank lines left by empty multi-line values
            let fieldCode = renderTemplate('schemas/FormField.php.njk', ctx)
                .replace(/^\s*[\r\n]/gm, '')
                .replace(/\n+$/, '');

            // --- TAMBAHAN UNTUK CUSTOM VIEW: FORCED READONLY ---
            if (field.is_forced_readonly) {
                if (fieldCode.trim().endsWith(',')) {
                    fieldCode = fieldCode.trim().slice(0, -1) + "->disabled()->dehydrated(false),";
                } else {
                    fieldCode += "->disabled()->dehydrated(false)";
                }
            }

            formFieldsCode.push(fieldCode);
        }

        // ============================================================
        // LOGIK 2: MEDIA (IMAGE, UPLOAD, MAP, YOUTUBE)
        // ============================================================
        else if (field.media_type === 'image') {
            let imageCode = renderTemplate('schemas/FileUploadField.php.njk', {
                field_name: field.field_name,
                label: field.caption || toTitleCase(field.field_name),
                avatar_crop: field.dv_thumb_shape === 'circular' ? '->avatar()->circleCropper()' : '',
                kebab_field_name: field.field_name.replace(/_/g, '-'),
                disk: field.image_storage_provider || 'public',
            }).replace(/^\s*[\r\n]/gm, '').replace(/\n+$/, '');

            if (field.is_forced_readonly) {
                 imageCode = imageCode.replace(',', '->disabled()->dehydrated(false),');
            }

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
 * [MAIN FUNCTION] Generates the Form Schema file for standard Resources.
 */
async function generateFilamentSchemasForm(fullSchema, basePath) {
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
            
            // GRID LOGIC
            const gridType = tableData.column_grid_type || 'dynamic';
            let gridColumnControl;
            if (gridType === 'static') {
                const columns = parseInt(tableData.static_grid_columns) || 2;
                let grid2 = '';
                let grid3 = '';
                if (columns === 2) { grid2 = "'md' => 2,"; } 
                else if (columns === 3) { grid2 = "'md' => 2,"; grid3 = "'xl' => 3,"; }
                
                gridColumnControl = `->columns([
        'default' => 1,
        ${grid2}
        ${grid3}
    ])`;
            } else {
                gridColumnControl = `->columns(fn (Page $livewire) => $livewire->gridColumns)
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
            }

            // Render outer template with all context
            let formContent = renderTemplate('app/Filament/Resources/SchemasForm.php.njk', {
                table_name_singular: modelNameSingular,
                table_name_plural: modelNamePlural,
                import_resources: Array.from(importResources).join('\n'),
                grid_column_control: gridColumnControl,
                detail_view_title: tableData.detail_view_title || '',
                all_columns_form: generateFormSchemaString(tableData, relationships, tableName, fullSchema),
            });

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
 * [HELPER] Generates a single Schema Class file (for Custom Module).
 */
function generateSingleSchemaClass(basePath, resourceFolder, className, tableData, fullSchema, tableName) {
    const { project: projectSettings, database: { relationships } } = fullSchema;

    // Use Module Name for the Model
    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '')
                        ? tableData.module_name
                        : tableName;
    const modelNameSingular = toSingularPascalCase(nameSource);

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

    // Render outer template (custom class name, custom namespace folder)
    let formContent = renderTemplate('app/Filament/Resources/SchemasForm.php.njk', {
        table_name_singular: modelNameSingular,
        table_name_plural: resourceFolder, // Namespace uses the custom folder
        form_class_name: className,
        import_resources: Array.from(importResources).join('\n'),
        grid_column_control: `->columns(fn (Page $livewire) => $livewire->gridColumns ?? 2)`,
        detail_view_title: tableData.table_view_title || '',
        all_columns_form: generateFormSchemaString(tableData, relationships, tableName, fullSchema),
    });

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

async function generateFilamentSchemasCustomModules(fullSchema, basePath) {
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
                    const schemaClassName = `${moduleSafeNameSingular}Form`; 

                    // Bina Virtual Fields (Readonly, Display Order & Settings Override Logic)
                    // ▼▼▼ PEMBAIKAN GENERATOR: SALIN DEFAULT DAHULU, KEMUDIAN OVERRIDE ▼▼▼
                    const virtualFields = {};
                    
                    // 1. Copy ALL fields from the original table (Default Module)
                    for (const [fName, fData] of Object.entries(tableData.fields)) {
                        virtualFields[fName] = { ...fData }; // Deep copy
                    }

                    // 2. Tindihkan (Override) dengan tetapan khusus Custom Module jika wujud
                    if (moduleObj.fields && Array.isArray(moduleObj.fields)) {
                        moduleObj.fields.forEach(f => {
                            const fieldId = parseInt(f.field_id, 10);
                            
                            // Find the field name by ID (avoids DataType String vs Int issues)
                            let fieldName = null;
                            for (const [fName, fData] of Object.entries(tableData.fields)) {
                                if (parseInt(fData.field_id, 10) === fieldId) {
                                    fieldName = fName;
                                    break;
                                }
                            }

                            if (fieldName && virtualFields[fieldName]) {
                                // Tindih status Read-Only
                                if (f.isReadonly === true || f.is_readonly === 1) {
                                    virtualFields[fieldName].is_forced_readonly = true;
                                }
                                
                                // Tindih susunan (Order)
                                if (f.display_order !== undefined) {
                                    virtualFields[fieldName].field_order = f.display_order;
                                }

                                // Tindih sebarang Settings Override (Cth: hide_in_dv, dll)
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
                    
                    // Perlu pass 'module_name' original supaya helper tahu nama Model
                    const virtualTableData = { 
                        ...tableData, 
                        fields: virtualFields, 
                        table_view_title: moduleObj.module_name,
                        module_name: tableData.module_name // PENTING: Kekalkan module_name asal
                    };

                    generateSingleSchemaClass(
                        basePath,
                        moduleSafeNamePlural,    // resourceFolder
                        schemaClassName,         // className
                        virtualTableData,
                        fullSchema,
                        tableName
                    );
                    count++;
                }
            }
        }
        return { success: true, message: `${count} Custom Module Schemas generated.` };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// KEMASKINI EXPORT
module.exports = {
    generateFilamentSchemasForm,
    generateSingleSchemaClass,
    generateFormSchemaString,
    generateFilamentSchemasCustomModules
};
// KEMASKINI EXPORT
module.exports = {
    generateFilamentSchemasForm,
    generateSingleSchemaClass,
    generateFormSchemaString,
    generateFilamentSchemasCustomModules
};