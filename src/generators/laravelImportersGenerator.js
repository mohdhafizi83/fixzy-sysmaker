const fs = require('fs');
const path = require('path');
const { 
    toPascalCase, 
    toCamelCase, 
    toSingularPascalCase, 
    toTitleCase,
    readTemplate    
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
        const fullTemplateContent = readTemplate('app/Filament/Imports/Importer.template');

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

            // ========================================================================
            // 1. LOGIK PENAMAAN (MODULE NAME)
            // ========================================================================
            const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                                ? tableData.module_name 
                                : tableName;

            const modelName = toSingularPascalCase(nameSource); // Cth: StudentInfo
            const importerClassName = `${modelName}Importer`;
            
            let fileContent = fullTemplateContent;

            // --- REPLACEMENTS LEVEL KELAS ---
            fileContent = fileContent.replace(/<<MODEL_NAME>>/g, modelName);

            // Import Parent Models untuk Relationship
            const parentRels = relationships.filter(r => r.child_table_name === tableName);
            const useStatements = new Set();
            
            parentRels.forEach(rel => {
                // Cari module_name untuk Parent Table
                const parentTableData = tables[rel.parent_table_name];
                const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                                        ? parentTableData.module_name
                                        : rel.parent_table_name;

                const parentModel = toSingularPascalCase(parentNameSource);
                useStatements.add(`use App\\Models\\${parentModel};`);
            });
            fileContent = fileContent.replace(/<<RELATIONSHIP_MODEL_NAME>>/g, Array.from(useStatements).join('\n'));

            // Tajuk (Frasa)
            const phrase = toTitleCase(nameSource); 
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
                    // Nama Relationship perlu ikut standard Model Generator (CamelCase Module Name)
                    const parentTableData = tables[field.lookup_parent_table];
                    const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                                            ? parentTableData.module_name
                                            : field.lookup_parent_table;
                    
                    // Cth: department (dari Module 'Department')
                    const relationshipMethod = toCamelCase(toSingularPascalCase(parentNameSource)); 
                    
                    colOrRelName = relationshipMethod; 
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
                
                // ... (Logik Type Modifiers - KEKAL SAMA) ...
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

                // Rules logic (KEKAL SAMA)
                let rulesList = [];
                if (field.required == 1) rulesList.push("'required'");
                if (displayType === 'text_input' && (dataType === 'INT' || dataType === 'BIGINT')) rulesList.push("'integer'");

                if (dataType === 'INT' || dataType === 'BIGINT') {
                    if (field.min_value !== null && field.min_value !== undefined && field.min_value !== '') rulesList.push(`'min:${field.min_value}'`);
                    if (field.max_value !== null && field.max_value !== undefined && field.max_value !== '') rulesList.push(`'max:${field.max_value}'`);
                } else {
                    if (field.min_length !== null && field.min_length !== undefined && field.min_length !== '') rulesList.push(`'min:${field.min_length}'`);
                    if (field.max_length !== null && field.max_length !== undefined && field.max_length !== '') rulesList.push(`'max:${field.max_length}'`);
                    else { if (field.length !== null && field.length !== undefined && field.length !== '') rulesList.push(`'max:${field.length}'`); }
                }

                if (dataType === 'JSON') rulesList.push("'array'");
                if (field.format_as === 'email') rulesList.push("'email'");
                if (dataType === 'DATE') rulesList.push("'date'");
                if (dataType === 'DATETIME' || dataType === 'TIMESTAMP') rulesList.push("'datetime'");

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

                // Dummy Data Logic (KEKAL SAMA)
                let dummyData = [`Sample ${captionVal} 1`, `Sample ${captionVal} 2`];
                if (dataType.includes('INT') || dataType.includes('FLOAT')) dummyData = ["1", "2"];
                else if (dataType === 'DATE') dummyData = ["2024-01-01", "2024-12-31"];
                else if (dataType === 'DATETIME' || dataType === 'TIMESTAMP') dummyData = ["2024-01-01 22:56:00", "2024-12-31 22:56:00"];
                else if (field.format_as === 'email') dummyData = ["user1@example.com", "user2@example.com"];
                else if (dataType === 'BOOLEAN' || dataType === 'TINYINT') dummyData = ["1", "0"];
                
                colCode = colCode.replace(/<<DUMMY_DATA>>/g, `['${dummyData[0]}', '${dummyData[1]}']`);

                const cleanColCode = colCode.split('\n').filter(line => line.trim() !== '').join('\n');
                generatedColumns.push(cleanColCode);
            }

            const finalColumnsBlock = generatedColumns.join(',\n\n            ');
            const newReturnBlock = `return [\n            ${finalColumnsBlock},\n        ];`;
            fileContent = fileContent.replace(columnBlockRegex, newReturnBlock);

            // --- FASA 2: RESOLVE RECORD LOGIC ---
            // Pass 'tables' untuk lookup module_name parent
            const resolveLogic = generateResolveRecordLogic(tableData, modelName, tables);
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
function generateResolveRecordLogic(tableData, modelName, tables) {
    const fields = tableData.fields;
    const constraints = tableData.constraints || [];
    
    // 1. Cari Unique Constraints
    let targetConstraintColumns = null;
    const compositeUnique = constraints.find(c => c.constraint_type === 'UNIQUE');
    if (compositeUnique) {
        try { targetConstraintColumns = JSON.parse(compositeUnique.columns); } catch (e) { }
    }
    if (!targetConstraintColumns) {
        const uniqueField = Object.values(fields).find(f => f.unique === 1 && f.field_name !== 'id');
        if (uniqueField) { targetConstraintColumns = [uniqueField.field_name]; }
    }

    if (!targetConstraintColumns || targetConstraintColumns.length === 0) {
        return `return new ${modelName}();`;
    }

    // Persediaan Kod
    let lookupCode = "";
    let nullChecks = [];
    let queryArrayItems = [];

    // Loop setiap column
    targetConstraintColumns.forEach(colName => {
        const field = fields[colName];
        if (!field) return;

        if (field.lookup_parent_table) {
            // --- FOREIGN KEY LOGIC (GUNA MODULE NAME) ---
            
            // Dapatkan Module Name Parent
            const parentTableData = tables[field.lookup_parent_table];
            const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                                    ? parentTableData.module_name
                                    : field.lookup_parent_table;

            // CSV Key: relationship name (camelCase Module Name)
            // Cth: studentInfo
            const csvKey = toCamelCase(toSingularPascalCase(parentNameSource));
            
            // Variable: $studentInfo
            const parentVar = `$${csvKey}`;
            
            // Model Parent: PascalCase Module Name
            const parentModel = toSingularPascalCase(parentNameSource);
            
            // Lookup Column: lookup_caption_1
            const lookupCol = field.lookup_caption_1 || 'id';

            // JANA KOD LOOKUP
            lookupCode += `\n        ${parentVar} = ${parentModel}::firstWhere('${lookupCol}', $this->data['${csvKey}'] ?? null);`;
            
            nullChecks.push(`!${parentVar}`);
            queryArrayItems.push(`'${colName}' => ${parentVar}->id`);

        } else {
            const csvKey = colName;
            queryArrayItems.push(`'${colName}' => $this->data['${csvKey}']`);
        }
    });

    let phpCode = "";
    if (lookupCode) { phpCode += lookupCode + "\n"; }
    if (nullChecks.length > 0) {
        phpCode += `\n        if (${nullChecks.join(' || ')}) {\n            return null;\n        }\n`;
    }

    const queryArrayString = queryArrayItems.join(",\n            ");
    phpCode += `\n        return ${modelName}::firstOrNew([\n            ${queryArrayString}\n        ]);`;

    return phpCode;
}

module.exports = { generateFilamentImporters };