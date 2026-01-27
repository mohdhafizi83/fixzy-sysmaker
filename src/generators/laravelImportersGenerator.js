const fs = require('fs');
const path = require('path');
const { 
    toPascalCase, 
    toCamelCase, 
    toSingularPascalCase, 
    toTitleCase 
} = require('../utils');

/**
 * Menjana fail Filament Importer berdasarkan schema database dan template yang disediakan.
 * Termasuk Fasa 1 (Columns) dan Fasa 2 (Resolve Record Logic).
 */
async function generateFilamentImporters(fullSchema, outputDir) {
    try {
        const tables = fullSchema.database.table;
        const relationships = fullSchema.database.relationships;
        
        // Lokasi Template
        const templatePath = path.join(__dirname, '../templates/php/filament/app/Filament/Imports/Importer.template');
        
        if (!fs.existsSync(templatePath)) {
            console.error(`Template Importer tidak ditemui di: ${templatePath}`);
            return { success: false, message: 'Template Importer missing.' };
        }

        const fullTemplateContent = fs.readFileSync(templatePath, 'utf8');

        // EKSTRAK STRUKTUR IMPORT COLUMN DARI TEMPLATE
        const columnBlockRegex = /return\s*\[\s*([\s\S]*?)\s*\];/;
        const match = fullTemplateContent.match(columnBlockRegex);

        if (!match || !match[1]) {
            throw new Error("Gagal mengekstrak struktur ImportColumn dari Importer.template.");
        }

        const columnTemplateRaw = match[1];

        // Pastikan direktori output wujud
        const importersDir = path.join(outputDir, 'app/Filament/Imports');
        if (!fs.existsSync(importersDir)) {
            fs.mkdirSync(importersDir, { recursive: true });
        }

        // Loop setiap table
        for (const tableName in tables) {
            const tableData = tables[tableName];
            const modelName = toSingularPascalCase(tableName);
            const importerClassName = `${modelName}Importer`;
            
            let fileContent = fullTemplateContent;

            // --- REPLACEMENTS LEVEL KELAS ---
            fileContent = fileContent.replace(/<<MODEL_NAME>>/g, modelName);

            const parentRels = relationships.filter(r => r.child_table_name === tableName);
            const useStatements = new Set();
            parentRels.forEach(rel => {
                const parentModel = toSingularPascalCase(rel.parent_table_name);
                useStatements.add(`use App\\Models\\${parentModel};`);
            });
            fileContent = fileContent.replace(/<<RELATIONSHIP_MODEL_NAME>>/g, Array.from(useStatements).join('\n'));

            const phrase = tableName.replace(/_/g, ' '); 
            fileContent = fileContent.replace(/<<FRASE_MODEL_NAME>>/g, phrase);

            // --- FASA 1: IMPORT COLUMNS ---
            const fields = tableData.fields;
            const generatedColumns = [];

            for (const fieldName in fields) {
                const field = fields[fieldName];
                let colCode = columnTemplateRaw;

                let colOrRelName = fieldName;
                let captionVal = field.caption;
                let relationshipCode = '';
                
                if (field.lookup_parent_table) {
                    colOrRelName = toCamelCase(field.lookup_parent_table); 
                    captionVal = field.lookup_caption_1 || field.caption;
                    relationshipCode = `->relationship(resolveUsing: ['${field.lookup_caption_1}'])`;
                }

                colCode = colCode.replace(/<<COLUMN_OR_RELATIONSHIP_NAME>>/g, colOrRelName);
                colCode = colCode.replace(/<<CAPTION_VALUE>>/g, captionVal);
                colCode = colCode.replace(/<<RELATIONSHIP>>/g, relationshipCode);

                // --- TAMBAHAN BARU: REQUIRED MAPPING LOGIC ---
                let mappingCode = '';
                if (field.required == 1) {
                    mappingCode = '->requiredMapping()';
                }
                colCode = colCode.replace(/<<MAPPING>>/g, mappingCode);
                // ----------------------------------------------
                
                // ... (Logik Type Modifiers Fasa 1 kekal sama seperti sebelum ini) ...
                const dataType = field.data_type.toUpperCase();
                const displayType = field.display_type || 'text_input';

                let isNumericCode = '';
                const numericTypes = ['INT', 'INTEGER', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'REAL', 'NUMERIC'];
                if (numericTypes.includes(dataType) || (displayType === 'text_input' && dataType === 'DECIMAL')) {
                    isNumericCode = '->numeric()';
                }
                colCode = colCode.replace(/<<IS_NUMERIC>>/g, isNumericCode);

                let isIntegerCode = '';
                if (displayType === 'text_input' && (dataType === 'INT' || dataType === 'BIGINT' || dataType === 'INTEGER')) {
                    isIntegerCode = '->integer()';
                }
                colCode = colCode.replace(/<<IS_INTEGER>>/g, isIntegerCode);

                let booleanTypeCode = '';
                if (displayType === 'check_box' && (dataType === 'BOOLEAN' || dataType === 'TINYINT')) {
                    booleanTypeCode = '->boolean()';
                }
                colCode = colCode.replace(/<<BOOLEAN_TYPE>>/g, booleanTypeCode);

                let jsonCode = '';
                if (dataType === 'JSON') jsonCode = "->multiple(',')";
                colCode = colCode.replace(/<<JSON_LIST_TO_ARRAY>>/g, jsonCode);

                if (field.helper_text) {
                    colCode = colCode.replace(/<<HELPER_TEXT>>/g, field.helper_text.replace(/'/g, "\\'"));
                } else {
                    colCode = colCode.replace(/->helperText\('<<HELPER_TEXT>>'\)/g, '');
                }

// Rules logic
                let rulesList = [];

                // 1. Required Rule
                if (field.required == 1) {
                    rulesList.push("'required'");
                }

                // 2. Integer Rule (Type Check)
                if (displayType === 'text_input' && (dataType === 'INT' || dataType === 'BIGINT')) {
                    rulesList.push("'integer'");
                }

                // 3. Min & Max Rules (Conditional based on DataType)
                if (dataType === 'INT' || dataType === 'BIGINT') {
                    // --- LOGIC UNTUK NOMBOR (Guna min_value / max_value) ---
                    
                    // Min Value
                    if (field.min_value !== null && field.min_value !== undefined && field.min_value !== '') {
                        rulesList.push(`'min:${field.min_value}'`);
                    }
                    
                    // Max Value
                    if (field.max_value !== null && field.max_value !== undefined && field.max_value !== '') {
                        rulesList.push(`'max:${field.max_value}'`);
                    }

                } else {
                    // --- LOGIC UNTUK TEKS/LAIN-LAIN (Guna min_length / max_length) ---
                    
                    // Min Length
                    if (field.min_length !== null && field.min_length !== undefined && field.min_length !== '') {
                        rulesList.push(`'min:${field.min_length}'`);
                    }
                    
                    // Max Length
                    if (field.max_length !== null && field.max_length !== undefined && field.max_length !== '') {
                        rulesList.push(`'max:${field.max_length}'`);
                    }else{
                        if (field.length !== null && field.length !== undefined && field.length !== '') {
                        rulesList.push(`'max:${field.length}'`);    
                        }
                        
                    }
                }

                // 4. Other Format Rules
                if (dataType === 'JSON') rulesList.push("'array'");
                if (field.format_as === 'email') rulesList.push("'email'");
                if (dataType === 'DATE') rulesList.push("'date'");
                if (dataType === 'DATETIME' || dataType === 'TIMESTAMP') rulesList.push("'datetime'");

                // 5. Custom Validations from field_validations table (Jika ada dalam kod asal anda)
                if (field.validations && Array.isArray(field.validations)) {
                    field.validations.forEach(val => {
                        let ruleString = val.rule_type;
                        if (val.rule_value_1) ruleString += `:${val.rule_value_1}`;
                        if (val.rule_value_2) ruleString += `,${val.rule_value_2}`;
                        rulesList.push(`'${ruleString}'`);
                    });
                }

                let rulesCode = '';
                if (rulesList.length > 0) rulesCode = `->rules([${rulesList.join(', ')}])`;
                colCode = colCode.replace(/<<RULES>>/g, rulesCode);

                // Dummy Data Logic
                let dummyData = [`Sample ${captionVal} 1`, `Sample ${captionVal} 2`];
                if (dataType.includes('INT') || dataType.includes('FLOAT')) dummyData = ["1", "2"];
                else if (dataType === 'DATE') dummyData = ["2024-01-01", "2024-12-31"];
                else if (dataType === 'DATETIME' || dataType === 'TIMESTAMP') dummyData = ["2024-01-01 22:56:00", "2024-12-31 22:56:00"];
                else if (field.format_as === 'email') dummyData = ["user1@example.com", "user2@example.com"];
                else if (dataType === 'BOOLEAN' || dataType === 'TINYINT') dummyData = ["1", "0"];
                else if (dataType === 'DECIMAL') dummyData = ["101.50", "202.50"];
                else if (dataType === 'BIGINT') dummyData = ["123456789", "987654321"];
                else if (dataType === 'UUID') dummyData = ["550e8400-e29b-41d4-a716-446655440000", "9f8c1d2a-7b6e-4c3d-9a2f-8d7e9c1b2a3f"];
                else if (dataType === 'JSON') dummyData = [`{
  "id": 1,
  "nama": "Ali",
  "email": "ali@example.com",
  "aktif": true
}`, `{
  "id": 2,
  "nama": "minah",
  "email": "minah@example.com",
  "aktif": false
}`];
                
                colCode = colCode.replace(/<<DUMMY_DATA>>/g, `['${dummyData[0]}', '${dummyData[1]}']`);

                const cleanColCode = colCode.split('\n').filter(line => line.trim() !== '').join('\n');
                generatedColumns.push(cleanColCode);
            }

            const finalColumnsBlock = generatedColumns.join(',\n\n            ');
            const newReturnBlock = `return [\n            ${finalColumnsBlock},\n        ];`;
            fileContent = fileContent.replace(columnBlockRegex, newReturnBlock);

            // --- FASA 2: RESOLVE RECORD LOGIC ---
            // Panggil fungsi penjana logik pintar
            const resolveLogic = generateResolveRecordLogic(tableData, modelName);
            fileContent = fileContent.replace(/\/\* Fasa 2 \*\//g, resolveLogic);

            // Tulis Fail
            const outputFilePath = path.join(importersDir, `${importerClassName}.php`);
            fs.writeFileSync(outputFilePath, fileContent);
            
            console.log(`Generated Importer: ${outputFilePath}`);
        }

        return { success: true, message: 'Importers generated successfully.' };

    } catch (error) {
        console.error('Error generating Filament Importers:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Fungsi Pintar untuk menjana logik resolveRecord() berdasarkan 6 Senario.
 */
function generateResolveRecordLogic(tableData, modelName) {
    const fields = tableData.fields;
    const constraints = tableData.constraints || [];
    
    // 1. Cari Unique Constraints (Composite atau Single)
    // Keutamaan: Composite Constraint > Single Column Unique
    let targetConstraintColumns = null;

    // Cari composite unique dahulu
    const compositeUnique = constraints.find(c => c.constraint_type === 'UNIQUE');
    if (compositeUnique) {
        try {
            targetConstraintColumns = JSON.parse(compositeUnique.columns);
        } catch (e) {
            console.warn(`Gagal parse constraint columns untuk table ${tableData.table_name}`);
        }
    }

    // Jika tiada composite, cari single unique column (selain ID primary key)
    if (!targetConstraintColumns) {
        const uniqueField = Object.values(fields).find(f => f.unique === 1 && f.field_name !== 'id');
        if (uniqueField) {
            targetConstraintColumns = [uniqueField.field_name];
        }
    }

    // --- SENARIO 6: NO UNIQUE (Create Only) ---
    if (!targetConstraintColumns || targetConstraintColumns.length === 0) {
        return `return new ${modelName}();`;
    }

    // Persediaan Kod
    let lookupCode = "";
    let nullChecks = [];
    let queryArrayItems = [];

    // Loop setiap column yang terlibat dalam unique constraint
    targetConstraintColumns.forEach(colName => {
        const field = fields[colName];
        
        if (!field) return; // Safety check

        if (field.lookup_parent_table) {
            // --- FOREIGN KEY LOGIC ---
            // CSV Key: relationship name (camelCase table parent)
            const csvKey = toCamelCase(field.lookup_parent_table);
            
            // Variable: $parentTable (camelCase)
            const parentVar = `$${csvKey}`;
            
            // Model Parent: PascalCase table parent
            const parentModel = toSingularPascalCase(field.lookup_parent_table);
            
            // Lookup Column: lookup_caption_1 (default 'id' jika tiada)
            const lookupCol = field.lookup_caption_1 || 'id';

            // JANA KOD LOOKUP
            lookupCode += `\n        ${parentVar} = ${parentModel}::firstWhere('${lookupCol}', $this->data['${csvKey}'] ?? null);`;
            
            // JANA KOD CHECK (Jika parent tak jumpa, return null)
            nullChecks.push(`!${parentVar}`);

            // MASUKKAN KE QUERY ARRAY (Guna ID dari parent yang jumpa)
            queryArrayItems.push(`'${colName}' => ${parentVar}->id`);

        } else {
            // --- RAW DATA LOGIC ---
            // CSV Key: field_name direct
            const csvKey = colName;
            
            // MASUKKAN KE QUERY ARRAY (Ambil direct dari CSV)
            queryArrayItems.push(`'${colName}' => $this->data['${csvKey}']`);
        }
    });

    // Bina Blok Kod PHP Akhir
    let phpCode = "";

    // 1. Masukkan Lookup Code (jika ada)
    if (lookupCode) {
        phpCode += lookupCode + "\n";
    }

    // 2. Masukkan Null Checks (jika ada FK)
    if (nullChecks.length > 0) {
        phpCode += `\n        if (${nullChecks.join(' || ')}) {\n            return null;\n        }\n`;
    }

    // 3. Masukkan Return firstOrNew
    // Format array PHP dengan kemas
    const queryArrayString = queryArrayItems.join(",\n            ");

    phpCode += `\n        return ${modelName}::firstOrNew([\n            ${queryArrayString}\n        ]);`;

    return phpCode;
}

module.exports = { generateFilamentImporters };