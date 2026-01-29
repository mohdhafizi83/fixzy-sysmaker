const fs = require('fs');
const path = require('path');
const pluralize = require('pluralize');

// IMPORT FUNGSI BANTUAN DARI UTILS
const { 
    toPascalCase,
    toCamelCase,
    toTitleCase,
    readTemplate
} = require('../utils');

/**
 * Menjana fail Exporter Filament v4 dengan Label Custom.
 * DIKEMASKINI: Logik Label Foreign Key menggunakan lookup_caption_1
 */
async function generateFilamentExports(fullSchema, basePath) {
    try {
        console.log("Menjana Filament Exports Script (dengan Label)...");

        const exportsDir = path.join(basePath, 'app', 'Filament', 'Exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        const templateContent = readTemplate('app/Filament/Exports/Exporter.template');

        // AMBIL DATA DARI STRUKTUR YANG BETUL
        const { database: { table: tables, relationships } } = fullSchema;

        // Loop setiap jadual
        for (const tableName in tables) {
            const tableData = tables[tableName];
            
            // Rule 1: Model Name (PascalCase Singular)
            const singularName = pluralize.singular(tableName);
            const modelName = toPascalCase(singularName);
            
            // Rule 3: Frasa (Normal Case) - untuk tajuk
            const fraseModelName = toTitleCase(tableName);

            // Dapatkan senarai medan (fields)
            const columns = Object.values(tableData.fields);

            // Rule 2: Bina Kod Column
            const exportColumnsCode = columns.map(field => {
                const fieldName = field.field_name;
                
                // --- LOGIK PENENTUAN LABEL (UPDATED) ---
                let rawLabelSource = field.caption || field.field_label || fieldName; // Default asal

                // Semak jika field ini adalah Foreign Key (ada lookup_parent_table)
                const isForeignKeyField = field.lookup_parent_table && field.lookup_parent_table.trim() !== '';

                if (isForeignKeyField) {
                    // Jika Foreign Key, GANTI label dengan lookup_caption_1
                    // (Pastikan lookup_caption_1 wujud, jika tidak fallback ke default)
                    if (field.lookup_caption_1 && field.lookup_caption_1.trim() !== '') {
                        rawLabelSource = field.lookup_caption_1;
                    }
                }

                // Format label kepada Title Case & Escape single quotes
                let finalLabel = toTitleCase(rawLabelSource).replace(/'/g, "\\'"); 
                
                // --- BINA KOD COLUMN ---
                let columnCode = '';

                // Semak Relationship untuk Syntax ExportColumn::make(...)
                const fkRel = relationships.find(r => 
                    r.child_table_name === tableName && 
                    r.fk_child_field === fieldName
                );

                if (fkRel) {
                    // Tentukan nama relationship
                    let relName = pluralize.singular(fkRel.parent_table_name);
                    relName = toCamelCase(relName);

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

                // Tambah Modifiers (Limit & JSON)
                if (field.tv_text_limit && field.tv_text_limit > 0) {
                    columnCode += `->limit(${field.tv_text_limit})`;
                }

                if (field.data_type && field.data_type.toLowerCase() === 'json') {
                    columnCode += `->listAsJson()`;
                }

                // MASUKKAN LABEL YANG TELAH DIPROSES
                columnCode += `->label('${finalLabel}')`;

                // Format inden yang kemas
                return `            ${columnCode},`;

            }).join('\n');


            // Replacements dalam Template
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