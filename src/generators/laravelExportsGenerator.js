const fs = require('fs');
const path = require('path');
const pluralize = require('pluralize');

// IMPORT FUNGSI BANTUAN DARI UTILS
const { 
    toPascalCase,
    toCamelCase,
    toTitleCase,
    toSingularPascalCase, // Tambah ini
} = require('../utils');
const { renderTemplate } = require('../render/engine');

/**
 * Menjana fail Exporter Filament v4 dengan Label Custom.
 * DIKEMASKINI: Logik Penamaan menggunakan MODULE NAME.
 */
async function generateFilamentExports(fullSchema, basePath) {
    try {
        console.log("Menjana Filament Exports Script (dengan Label)...");

        const exportsDir = path.join(basePath, 'app', 'Filament', 'Exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        const templateName = 'app/Filament/Exports/Exporter.php.njk';

        // AMBIL DATA DARI STRUKTUR YANG BETUL
        const { database: { table: tables, relationships } } = fullSchema;

        // Loop over every table
        for (const tableName in tables) {
            const tableData = tables[tableName];
            
            // ========================================================================
            // 1. LOGIK PENAMAAN (MODULE NAME)
            // ========================================================================
            const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                                ? tableData.module_name 
                                : tableName;

            // Model Name (PascalCase Singular)
            // Cth: StudentInfo
            const modelName = toSingularPascalCase(nameSource);
            
            // Phrase for the Title
            const fraseModelName = toTitleCase(nameSource);

            // Get the list of fields
            const columns = Object.values(tableData.fields);

            // Rule 2: Bina Kod Column
            const exportColumnsCode = columns.map(field => {
                const fieldName = field.field_name;
                
                // --- LOGIK LABEL ---
                let rawLabelSource = field.caption || field.field_label || fieldName;

                const isForeignKeyField = field.lookup_parent_table && field.lookup_parent_table.trim() !== '';

                if (isForeignKeyField) {
                    if (field.lookup_caption_1 && field.lookup_caption_1.trim() !== '') {
                        rawLabelSource = field.lookup_caption_1;
                    }
                }

                let finalLabel = toTitleCase(rawLabelSource).replace(/'/g, "\\'"); 
                
                // --- BINA KOD COLUMN ---
                let columnCode = '';

                // Semak Relationship
                const fkRel = relationships.find(r => 
                    r.child_table_name === tableName && 
                    r.fk_child_field === fieldName
                );

                if (fkRel) {
                    // Tentukan nama relationship mengikut MODULE NAME Parent
                    const parentTableData = tables[fkRel.parent_table_name];
                    const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                                            ? parentTableData.module_name
                                            : fkRel.parent_table_name;

                    let relName = toCamelCase(toSingularPascalCase(parentNameSource));

                    // Handle Self-Referencing
                    if (fkRel.parent_table_name === fkRel.child_table_name) {
                        relName = 'parent';
                    }
                    
                    if (!field.lookup_caption_2 || field.lookup_caption_2.trim() === '') {
                        // Rule 2.1: Single Caption
                        const lookupCol = field.lookup_caption_1 || 'id';
                        columnCode = `ExportColumn::make('${relName}.${lookupCol}')`;
                    } else {
                        // Rule 2.2: Double Caption
                        const lookupCaption = `${field.lookup_caption_1}_${field.lookup_caption_2}`;
                        columnCode = `ExportColumn::make('${relName}.${lookupCaption}')`;
                    }
                } else {
                    // Rule 2.5: Standard Column
                    columnCode = `ExportColumn::make('${fieldName}')`;
                }

                // Tambah Modifiers
                if (field.tv_text_limit && field.tv_text_limit > 0) {
                    columnCode += `->limit(${field.tv_text_limit})`;
                }

                if (field.data_type && field.data_type.toLowerCase() === 'json') {
                    columnCode += `->listAsJson()`;
                }

                columnCode += `->label('${finalLabel}')`;

                return `            ${columnCode},`;

            }).join('\n');


            // Render template dengan context object
            const fileContent = renderTemplate(templateName, {
                model_name: modelName,
                frase_model_name: fraseModelName,
                export_columns: exportColumnsCode,
            });

            const fileName = `${modelName}Exporter.php`;
            fs.writeFileSync(path.join(exportsDir, fileName), fileContent);
            console.log(`   - Generated: ${fileName}`);
        }

        return { success: true };

    } catch (error) {
        console.error("Failed to generate Filament Exports:", error);
        return { success: false, message: error.message };
    }
}

module.exports = { generateFilamentExports };