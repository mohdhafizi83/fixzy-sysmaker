const fs = require('fs');
const path = require('path');
const pluralize = require('pluralize');

// Helper: Tukar snake_case ke PascalCase
function toPascalCase(str) {
    return str
        .replace(/_/g, ' ')
        .replace(/(\w)(\w*)/g, function(g0,g1,g2){return g1.toUpperCase() + g2.toLowerCase();})
        .replace(/\s/g, '');
}

// Helper: Tukar snake_case ke camelCase
function toCamelCase(str) {
    return str.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function readTemplate(relativePath) {
    const templatePath = path.join(__dirname, '..', 'templates', 'php', 'filament', relativePath);
    return fs.readFileSync(templatePath, 'utf8');
}

/**
 * Menjana fail Exporter Filament v4 dengan Label Custom.
 */
async function generateFilamentExports(fullSchema, basePath) {
    try {
        console.log("Menjana Filament Exports Script (dengan Label)...");

        const exportsDir = path.join(basePath, 'app', 'Filament', 'Exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        const templateContent = readTemplate('app/Filament/Exports/Exporter.template');

        for (const table of fullSchema.tables) {
            const tableName = table.table_name;
            
            // Rule 1: Model Name (PascalCase Singular)
            const modelName = toPascalCase(pluralize.singular(tableName));
            
            // Rule 3: Frasa (Normal Case)
            const fraseModelName = tableName.replace(/_/g, ' ');

            const columns = fullSchema.table_columns.filter(c => c.table_id === table.table_id);

            // Rule 2: Bina Kod Column
            const exportColumnsCode = columns.map(col => {
                const fieldName = col.column_name;
                
                // Dapatkan CAPTION (Default ke fieldName jika tiada caption)
                let caption = col.caption || fieldName; 
                // Escape single quotes dalam caption (cth: Student's Name -> Student\'s Name)
                caption = caption.replace(/'/g, "\\'");

                // Kod Asas Column (ExportColumn::make(...))
                let columnCode = '';

                const isForeignKey = col.lookup_parent_table && col.lookup_parent_table.trim() !== '';

                if (isForeignKey) {
                    const lookupParentTable = toCamelCase(col.lookup_parent_table);
                    
                    if (!col.lookup_caption_2 || col.lookup_caption_2.trim() === '') {
                        // Rule 2.1: Single Caption
                        columnCode = `ExportColumn::make('${lookupParentTable}.${col.lookup_caption_1}')`;
                    } else {
                        // Rule 2.2: Double Caption
                        const lookupCaption = `${col.lookup_caption_1}_${col.lookup_caption_2}`;
                        columnCode = `ExportColumn::make('${lookupParentTable}.${lookupCaption}')`;
                    }
                } else {
                    // Rule 2.5: Standard Column
                    columnCode = `ExportColumn::make('${fieldName}')`;
                }

                // Tambah Modifiers (Limit & JSON)
                // Rule 2.3: Limit
                if (col.tv_text_limit && col.tv_text_limit > 0) {
                    columnCode += `->limit(${col.tv_text_limit})`;
                }

                // Rule 2.4: JSON
                if (col.data_type && col.data_type.toLowerCase() === 'json') {
                    columnCode += `->listAsJson()`;
                }

                // BARU: Tambah Label (Rule 2 + Tambahan Label)
                columnCode += `->label('${caption}')`;

                // Format inden yang kemas
                return `            ${columnCode},`;

            }).join('\n');


            // Replacements
            let fileContent = templateContent;
            fileContent = fileContent.replace(/<<MODEL_NAME>>/g, modelName);
            fileContent = fileContent.replace(/<<FRASE_MODEL_NAME>>/g, fraseModelName);
            fileContent = fileContent.replace(/<<EXPORTCOLUMN>>/g, exportColumnsCode);

            const fileName = `${modelName}Exporter.php`;
            fs.writeFileSync(path.join(exportsDir, fileName), fileContent);
            console.log(`   - Generated: ${fileName}`);
        }

        return { success: true };

    } catch (error) {
        console.error("Gagal menjana Filament Exports:", error);
        return { success: false, message: error.message };
    }
}

module.exports = { generateFilamentExports };