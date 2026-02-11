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
function generateSingleRelationManager(rel, basePath, templateContent, fullSchema) {
    const { database: { table: tables } } = fullSchema;

    // Logik Asal: Langkau jika 'one-to-one' atau melibatkan 'users'
    if (rel.relationship_type === 'one-to-one' || rel.parent_table_name === 'users' || rel.child_table_name === 'users') {
        return;
    }

    let managerContent = templateContent;

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
    // Nama folder Resource induk: StudentInfos (bukan Pelajars)
    const parentTablePlural = toPluralPascalCase(parentNameSource);
    
    // Nama label Child dalam UI (Title): StudentInfos
    const childTablePlural = toPluralPascalCase(childNameSource);
    
    // Nama Fail/Class Child: StudentInfoRelationManager
    const childTableSingular = toSingularPascalCase(childNameSource);
    
    // --- 2. TENTUKAN NAMA FUNGSI HUBUNGAN (RELATIONSHIP NAME) ---
    // Mesti sama dengan Model Generator: camelCase dari Module Name child
    // Jika self-referencing (Parent -> Children), guna 'children'
    const relationshipName = rel.parent_table_name === rel.child_table_name
        ? 'children' 
        : toPluralCamelCase(childNameSource); 
    
    // --- 3. LAKUKAN PENGGANTIAN PLACEHOLDER ---
    // Namespace: App\Filament\Resources\StudentInfos\RelationManagers
    managerContent = managerContent.replace(/<<TABLE_NAME_PLURAL>>/g, parentTablePlural);
    
    // Label UI ($title)
    managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_PLURAL>>/g, childTablePlural);
    
    // Nama Method dalam Model ($relationship)
    managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_PLURAL_CAMEL>>/g, relationshipName);
    
    // Nama Class (class StudentInfoRelationManager)
    managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_SINGULAR>>/g, childTableSingular);

    // --- 4. SIMPAN FAIL ---
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
            // Hantar fullSchema untuk lookup module_name
            generateSingleRelationManager(rel, basePath, templateContent, fullSchema);
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