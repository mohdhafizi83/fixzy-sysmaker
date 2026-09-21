const fs = require('fs');
const path = require('path');
const {
    toSingularPascalCase,
    toPluralPascalCase,
    toPluralCamelCase,
} = require('../utils');
const { renderTemplate } = require('../render/engine');

/**
 * [HELPER] Menjana satu fail Relation Manager.
 */
function generateSingleRelationManager(rel, basePath, fullSchema) {
    const { database: { table: tables } } = fullSchema;

    // Logik Asal: Langkau jika 'one-to-one' atau melibatkan 'users'
    if (rel.relationship_type === 'one-to-one' || rel.parent_table_name === 'users' || rel.child_table_name === 'users') {
        return;
    }

    // --- 1. DAPATKAN MODULE NAME UNTUK PARENT & CHILD ---
    const parentTableData = tables[rel.parent_table_name];
    const childTableData = tables[rel.child_table_name];

    const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                            ? parentTableData.module_name
                            : rel.parent_table_name;

    const childNameSource = (childTableData && childTableData.module_name && childTableData.module_name.trim() !== '')
                            ? childTableData.module_name
                            : rel.child_table_name;

    // Sediakan variasi nama (Berasaskan MODULE NAME)
    const parentTablePlural = toPluralPascalCase(parentNameSource);
    const childTablePlural = toPluralPascalCase(childNameSource);
    const childTableSingular = toSingularPascalCase(childNameSource);

    // --- 2. TENTUKAN NAMA FUNGSI HUBUNGAN (RELATIONSHIP NAME) ---
    // If self-referencing (Parent -> Children), use 'children'
    const relationshipName = rel.parent_table_name === rel.child_table_name
        ? 'children'
        : toPluralCamelCase(childNameSource);

    // --- 3. RENDER TEMPLATE (context object; template owns layout) ---
    const managerContent = renderTemplate('app/Filament/Resources/RelationManagers.php.njk', {
        parent_plural: parentTablePlural,
        child_plural: childTablePlural,
        child_singular: childTableSingular,
        relationship_name: relationshipName,
    });

    // --- 4. SIMPAN FAIL ---
    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', parentTablePlural, 'RelationManagers');
    fs.mkdirSync(outputFolderPath, { recursive: true });

    const outputFilePath = path.join(outputFolderPath, `${childTableSingular}RelationManager.php`);
    fs.writeFileSync(outputFilePath, managerContent);
    console.log(`Relation Manager generated: ${outputFilePath}`);
}

/**
 * [MAIN] Generates all standard Relation Managers.
 */
async function generateFilamentRelationManagers(fullSchema, basePath) {
    try {
        const { database: { relationships } } = fullSchema;

        // Loop through every existing relationship
        for (const rel of relationships) {
            generateSingleRelationManager(rel, basePath, fullSchema);
        }

        return { success: true, message: 'Filament Relation Managers generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Relation Managers:', error);
        return { success: false, message: error.message };
    }
}

module.exports = {
    generateFilamentRelationManagers,
    generateSingleRelationManager
};
