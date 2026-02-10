const fs = require('fs');
const path = require('path');
const { 
    toSingularPascalCase, 
    toPluralPascalCase, 
    toPluralCamelCase, 
    readTemplate 
} = require('../utils');

/**
 * [HELPER] Menjana satu fail Relation Manager.
 */
function generateSingleRelationManager(rel, basePath, templateContent) {
    // Logik Asal: Langkau jika 'one-to-one' atau melibatkan 'users'
    if (rel.relationship_type === 'one-to-one' || rel.parent_table_name === 'users' || rel.child_table_name === 'users') {
        return;
    }

    let managerContent = templateContent;

    // Sediakan semua variasi nama yang diperlukan
    const parentTablePlural = toPluralPascalCase(rel.parent_table_name);
    const childTablePlural = toPluralPascalCase(rel.child_table_name);
    const childTableSingular = toSingularPascalCase(rel.child_table_name);
    
    // Tentukan nama fungsi hubungan yang betul
    const relationshipName = rel.parent_table_name === rel.child_table_name
        ? 'children' // Guna 'children' untuk hubungan kepada diri sendiri
        : toPluralCamelCase(rel.child_table_name); // Guna nama biasa untuk hubungan lain
    
    // Lakukan penggantian placeholder
    managerContent = managerContent.replace(/<<TABLE_NAME_PLURAL>>/g, parentTablePlural);
    managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_PLURAL>>/g, childTablePlural);
    managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_PLURAL_CAMEL>>/g, relationshipName);
    managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_SINGULAR>>/g, childTableSingular);

    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', parentTablePlural, 'RelationManagers');
    fs.mkdirSync(outputFolderPath, { recursive: true });

    const outputFilePath = path.join(outputFolderPath, `${childTableSingular}RelationManager.php`);
    fs.writeFileSync(outputFilePath, managerContent);
    console.log(`Relation Manager generated: ${outputFilePath}`);
}

/**
 * [UTAMA] Menjana semua Relation Managers standard.
 */
async function generateFilamentRelationManagers(fullSchema, basePath) {
    try {
        const { database: { relationships } } = fullSchema;
        const templateContent = readTemplate('app/Filament/Resources/RelationManagers.template');

        // Loop melalui setiap hubungan yang wujud
        for (const rel of relationships) {
            generateSingleRelationManager(rel, basePath, templateContent);
        }
        
        return { success: true, message: 'Filament Relation Managers generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Relation Managers:', error);
        return { success: false, message: error.message };
    }
}

module.exports = {
    generateFilamentRelationManagers,
    generateSingleRelationManager // Export jika perlu diguna pakai oleh Custom View Generator (walaupun biasanya Custom View link ke yang asal)
};