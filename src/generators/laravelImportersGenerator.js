// Filament Importer generator (Fixzy SysMaker).
// Emits one Filament Importer class per table (CSV column mapping,
// record resolution, smart-import profile wiring).
const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toTitleCase, toCamelCase } = require('../utils');
const { renderTemplate } = require('../render/engine');

const TEMPLATE = 'app/Filament/Imports/Importer.php.njk';

/**
 * Build the context column list for the Importer template.
 */
function buildColumnContext(fields, tables) {
    const columns = [];
    for (const fieldName in fields) {
        const field = fields[fieldName];

        let colOrRelName = fieldName;
        let captionVal = field.caption;
        let relationship = null;

        if (field.lookup_parent_table) {
            // Relationship name must follow the Model Generator standard (CamelCase Module Name)
            const parentTableData = tables[field.lookup_parent_table];
            const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                                    ? parentTableData.module_name
                                    : field.lookup_parent_table;

            const relationshipMethod = toCamelCase(toSingularPascalCase(parentNameSource));
            colOrRelName = relationshipMethod;
            captionVal = field.lookup_caption_1 || field.caption;
            relationship = field.lookup_caption_1;
        }

        const dataType = field.data_type.toUpperCase();
        const displayType = field.display_type || 'text_input';

        const numericTypes = ['INT', 'INTEGER', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'REAL', 'NUMERIC'];

        // Rules logic
        let rulesList = [];
        if (field.required == 1) rulesList.push("'required'");
        else rulesList.push("'nullable'");
        if (displayType === 'text_input' && (dataType === 'INT' || dataType === 'BIGINT')) rulesList.push("'integer'");

        if (dataType === 'INT' || dataType === 'BIGINT') {
            if (field.min_value !== null && field.min_value !== undefined && field.min_value !== '') rulesList.push(`'min:${field.min_value}'`);
            if (field.max_value !== null && field.max_value !== undefined && field.max_value !== '') rulesList.push(`'max:${field.max_value}'`);
        } else {
            if (field.min_length !== null && field.min_length !== undefined && field.min_length !== '') rulesList.push(`'min:${field.min_length}'`);
            if (field.length !== null && field.length !== undefined && field.length !== '') rulesList.push(`'max:${field.length}'`);
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

        // Dummy Data Logic
        let dummyData = [`Sample ${captionVal} 1`, `Sample ${captionVal} 2`];
        if (dataType.includes('INT') || dataType.includes('FLOAT')) dummyData = ["1", "2"];
        else if (dataType === 'DATE') dummyData = ["2024-01-01", "2024-12-31"];
        else if (dataType === 'DATETIME' || dataType === 'TIMESTAMP') dummyData = ["2024-01-01 22:56:00", "2024-12-31 22:56:00"];
        else if (field.format_as === 'email') dummyData = ["user1@example.com", "user2@example.com"];
        else if (dataType === 'BOOLEAN' || dataType === 'TINYINT') dummyData = ["1", "0"];

        columns.push({
            name: colOrRelName,
            label: String(captionVal ?? '').replace(/'/g, "\\'"),
            required_mapping: field.required == 1,
            relationship: relationship,
            numeric: numericTypes.includes(dataType) || (displayType === 'text_input' && dataType === 'DECIMAL'),
            integer: displayType === 'text_input' && (dataType === 'INT' || dataType === 'BIGINT' || dataType === 'INTEGER'),
            boolean: displayType === 'check_box' && (dataType === 'BOOLEAN' || dataType === 'TINYINT'),
            json_list: dataType === 'JSON',
            helper_text: field.helper_text ? field.helper_text.replace(/'/g, "\\'") : null,
            rules: rulesList.length > 0 ? rulesList.join(', ') : null,
            examples: `'${dummyData[0]}', '${dummyData[1]}'`,
        });
    }
    return columns;
}

/**
 * Smart function that generates resolveRecord() logic based on constraint scenarios.
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
        return `    return new ${modelName}();`;
    }

    // Persediaan Kod
    let lookupCode = "";
    let nullChecks = [];
    let queryArrayItems = [];

    targetConstraintColumns.forEach(colName => {
        const field = fields[colName];
        if (!field) return;

        if (field.lookup_parent_table) {
            // --- FOREIGN KEY LOGIC (GUNA MODULE NAME) ---
            const parentTableData = tables[field.lookup_parent_table];
            const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                                    ? parentTableData.module_name
                                    : field.lookup_parent_table;

            const csvKey = toCamelCase(toSingularPascalCase(parentNameSource));
            const parentVar = `$${csvKey}`;
            const parentModel = toSingularPascalCase(parentNameSource);
            const lookupCol = field.lookup_caption_1 || 'id';

            lookupCode += `\n        ${parentVar} = ${parentModel}::firstWhere('${lookupCol}', $this->data['${csvKey}'] ?? null);`;
            
            nullChecks.push(`!${parentVar}`);
            queryArrayItems.push(`'${colName}' => ${parentVar}->id`);

        } else {
            const csvKey = colName;
            queryArrayItems.push(`'${colName}' => $this->data['${csvKey}']`);
        }
    });

    let phpCode = "    ";
    if (lookupCode) { phpCode += lookupCode + "\n"; }
    if (nullChecks.length > 0) {
        phpCode += `\n        if (${nullChecks.join(' || ')}) {\n            return null;\n        }\n`;
    }

    const queryArrayString = queryArrayItems.join(",\n            ");
    phpCode += `\n        return ${modelName}::firstOrNew([\n            ${queryArrayString}\n        ]);`;

    return phpCode;
}

/**
 * Generate a Filament Importer class per table (CSV mapping, record
 * resolution, smart-import profile).
 * @param {object} fullSchema assembled project schema
 * @param {string} basePath generated app root
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function generateFilamentImporters(fullSchema, basePath) {
    try {
        const importersDir = path.join(basePath, 'app', 'Filament', 'Imports');
        if (!fs.existsSync(importersDir)) fs.mkdirSync(importersDir, { recursive: true });

        const { database: { table: tables, relationships } } = fullSchema;

        for (const tableName in tables) {
            const tableData = tables[tableName];

            const nameSource = (tableData.module_name && tableData.module_name.trim() !== '')
                                ? tableData.module_name
                                : tableName;
            const modelName = toSingularPascalCase(nameSource);
            const importerClassName = `${modelName}Importer`;
            const fraseModelName = toTitleCase(nameSource);

            // Import parent models for the relationship (skip own model — duplicate is fatal)
            const parentRels = relationships.filter(r => r.child_table_name === tableName);
            const useStatements = new Set();
            parentRels.forEach(rel => {
                const parentTableData = tables[rel.parent_table_name];
                const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                                        ? parentTableData.module_name
                                        : rel.parent_table_name;
                const parentModel = toSingularPascalCase(parentNameSource);
                if (parentModel === modelName) return;
                useStatements.add(`use App\\Models\\${parentModel};`);
            });

            const columns = buildColumnContext(tableData.fields, tables);
            const resolveLogic = generateResolveRecordLogic(tableData, modelName, tables);
            const importProfile = require('./importExportConfig').parseImportConfig(tableData);

            const fileContent = renderTemplate(TEMPLATE, {
                model_name: modelName,
                relationship_uses: Array.from(useStatements),
                columns,
                resolve_logic: resolveLogic,
                frase_model_name: fraseModelName,
                import_profile: importProfile
                    ? require('./importExportConfig').importConfigPhp(importProfile)
                    : null,
                import_dry_run_default: importProfile && importProfile.dry_run ? 'true' : 'false',
            });

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

module.exports = { generateFilamentImporters };
