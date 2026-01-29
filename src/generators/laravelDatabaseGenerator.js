const fs = require('fs');
const path = require('path');

// IMPORT FUNGSI BANTUAN DARI UTILS
const { 
    toSingularPascalCase,
    toPluralCamelCase,
    getFormattedTimestamp,
    toSingularCamelCase,
    getFieldDefinitionForMigration,
    getFakerFormatter,
    readTemplate
} = require('../utils');

/**
 * Menjana fail Model Laravel Filament berdasarkan skema pangkalan data.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentModels(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;

        const templateContent = readTemplate('app/Models/Model.template');
        const modelsPath = path.join(basePath, 'app', 'Models');
        fs.mkdirSync(modelsPath, { recursive: true });

        for (const tableName in tables) {
            if (tableName === 'users') continue;

            const tableData = tables[tableName];
            let modelContent = templateContent;
            
            // ... (logik sedia ada untuk traits, classname, fillable, casts tidak berubah) ...
            if (projectSettings.module_fake_data === 1) modelContent = modelContent.replace('<<IMPORT_FACTORY>>', 'use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;').replace('<<TRAIT_FACTORY>>', 'use HasFactory;');
            if (projectSettings.data_delete_type === 'soft') modelContent = modelContent.replace('<<IMPORT_SOFTDELETE>>', 'use Illuminate\\Database\\Eloquent\\SoftDeletes;').replace('<<TRAIT_SOFTDELETE>>', 'use SoftDeletes;');
            if (projectSettings.module_log_audit === 1) {
                const importAudit = `use OwenIt\\Auditing\\Contracts\\Auditable;\nuse OwenIt\\Auditing\\Auditable as AuditableTrait;`;
                modelContent = modelContent.replace('<<IMPORT_AUDIT>>', importAudit).replace('<<CLASS_IMPLEMENTS_AUDIT>>', 'implements Auditable').replace('<<TRAIT_AUDIT>>', 'use AuditableTrait;');
            }
            const className = toSingularPascalCase(tableName);
            modelContent = modelContent.replace(/<<CLASS_NAME>>/g, className);
            modelContent = modelContent.replace('<<TABLE_NAME>>', tableName);
            const primaryKeyField = Object.values(tableData.fields).find(f => f.primary_key === 1);
            modelContent = modelContent.replace('<<PRIMARY_KEY>>', primaryKeyField ? primaryKeyField.field_name : 'id');
            const excludedFields = ['created_at', 'updated_at', 'deleted_at', primaryKeyField?.field_name];
            const fillableFields = Object.values(tableData.fields).filter(field => !excludedFields.includes(field.field_name) && field.read_only !== 1).map(field => `\n        '${field.field_name}'`).join(',');
            modelContent = modelContent.replace('<<ARRAY_EDITABLE_BYUSER_FIELDS>>', fillableFields ? `${fillableFields}\n    ` : '');
            
            const castableFields = Object.values(tableData.fields).filter(field => 
                field.data_type === 'JSON' || 
                (field.data_type === 'BOOLEAN' && field.display_type === 'check_box')
            );
            
            if (castableFields.length > 0) {
                const castLines = castableFields.map(field => {
                    let castType = '';
                    if (field.data_type === 'JSON') {
                        castType = 'array';
                    } else if (field.data_type === 'BOOLEAN' && field.display_type === 'check_box') {
                        castType = 'boolean';
                    }
                    return `\n        '${field.field_name}' => '${castType}',`;
                }).join('');

                const castsProperty = `\n    protected \$casts = [${castLines}\n    ];`;
                modelContent = modelContent.replace('<<MODEL_CASTS>>', castsProperty);
            }

            // ▼▼▼ BLOK HUBUNGAN YANG DIUBAH SUAI ▼▼▼
            let relationshipFunctions = [];

            // Hubungan ke JADUAL LAIN (PARENT)
            relationships.filter(r => r.parent_table_name === tableName).forEach(rel => {
                const childClassName = toSingularPascalCase(rel.child_table_name);
                const foreignKey = rel.fk_child_field;
                const localKey = rel.parent_field;
                let functionName;

                if (rel.parent_table_name === rel.child_table_name) {
                    // KES KHAS: Hubungan kepada diri sendiri (Induk ke Anak)
                    functionName = 'children'; // Guna nama 'children'
                } else {
                    // Kes biasa
                    functionName = toPluralCamelCase(rel.child_table_name);
                }

                if (rel.relationship_type === 'one-to-one') {
                    if (rel.parent_table_name === rel.child_table_name) functionName = 'child'; // Singular untuk one-to-one
                    else functionName = toSingularCamelCase(rel.child_table_name);
                    
                    relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return \$this->hasOne(${childClassName}::class, '${foreignKey}', '${localKey}');\n    }`);
                } else {
                    relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return \$this->hasMany(${childClassName}::class, '${foreignKey}', '${localKey}');\n    }`);
                }
            });

            // Hubungan ke JADUAL LAIN (CHILD)
            relationships.filter(r => r.child_table_name === tableName).forEach(rel => {
                const parentClassName = toSingularPascalCase(rel.parent_table_name);
                const foreignKey = rel.fk_child_field;
                const ownerKey = rel.parent_field;
                let functionName;

                if (rel.parent_table_name === rel.child_table_name) {
                    // KES KHAS: Hubungan kepada diri sendiri (Anak ke Induk)
                    functionName = 'parent'; // Guna nama 'parent'
                } else {
                    // Kes biasa
                    functionName = toSingularCamelCase(rel.parent_table_name);
                }
                
                relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return \$this->belongsTo(${parentClassName}::class, '${foreignKey}', '${ownerKey}');\n    }`);
            });
            // ▲▲▲ TAMAT BLOK UBAH SUAI ▲▲▲

            modelContent = modelContent.replace('<<RELATIONSHIP_FUNCTIONS>>', relationshipFunctions.join(''));
            
            // ... (logik accessor & helper methods dikekalkan) ...
            let accessorFunctions = [];
            const uniqueAccessors = new Set();
            const childRelations = relationships.filter(r => r.parent_table_name === tableName);
            for (const rel of childRelations) {
                const childTable = tables[rel.child_table_name];
                if (!childTable) continue;
                const fkField = childTable.fields[rel.fk_child_field];
                if (!fkField) continue;
                if (fkField.lookup_caption_1 && fkField.lookup_caption_2) {
                    const firstField = fkField.lookup_caption_1;
                    const secondField = fkField.lookup_caption_2;
                    const separator = fkField.lookup_separator || ' ';
                    const accessorKey = `${firstField}|${secondField}`;
                    if (uniqueAccessors.has(accessorKey)) continue;
                    uniqueAccessors.add(accessorKey);
                    const lookupCaption = toPascalCase(firstField) + toPascalCase(secondField);
                    const accessorCode = `\n    public function get${lookupCaption}Attribute(): string\n    {\n        return "{\$this->${firstField}}${separator}({\$this->${secondField}})";\n    }`;
                    accessorFunctions.push(accessorCode);
                }
            }
            modelContent = modelContent.replace('<<COMBINE_FIELDS_VALUE>>', accessorFunctions.join('\n'));
            let helperMethods = [];
            const hasYoutubeField = Object.values(tableData.fields).some(field => field.media_type === 'youtube');
            if (hasYoutubeField) {
                const youtubeHelper = `\n    public function getCleanYoutubeUrl(string \$fieldName): string\n    {\n        \$url = \$this->{\$fieldName};\n        if (blank(\$url)) {\n            return '';\n        }\n\n        preg_match('/(?:v=|\\/v\\/|watch\\?v=|youtu\\.be\\/|embed\\/)([a-zA-Z0-9_-]{11})/', \$url, \$matches);\n\n        if (isset(\$matches[1])) {\n            return 'https://www.youtube.com/embed/' . \$matches[1];\n        }\n\n        return \$url;\n    }\n`;
                helperMethods.push(youtubeHelper);
            }
            modelContent = modelContent.replace('<<HELPER_METHODS>>', helperMethods.join('\n'));

            modelContent = modelContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            modelContent = modelContent.replace(/<<.*?>>/g, '');

            const outputFilePath = path.join(modelsPath, `${className}.php`);
            fs.writeFileSync(outputFilePath, modelContent);
            console.log(`Model generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Models generated successfully.' };
    } catch (error) {
        console.error('Failed to generate Filament Models:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Menjana fail Model User.php Laravel Filament secara spesifik.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentUserModel(fullSchema, basePath) {
    try {
        const projectSettings = fullSchema.project;
        const relationships = fullSchema.database.relationships;
        const userData = fullSchema.database.table.users;

        // Hentikan jika skema jadual 'users' tidak wujud
        if (!userData) {
            console.warn("Skema untuk jadual 'users' tidak ditemui. Melangkau penjanaan User.php.");
            return { success: true, message: 'User model skipped as users table was not found.' };
        }

        // Tentukan laluan templat dan pastikan ia wujud
        const templateContent = readTemplate('app/Models/User.template');
        let userModelContent = templateContent;

        // 1. & 2. Handle Soft Deletes
        if (projectSettings.data_delete_type === 'soft') {
            userModelContent = userModelContent.replace('<<IMPORT_SOFTDELETE>>', 'use Illuminate\\Database\\Eloquent\\SoftDeletes;');
            userModelContent = userModelContent.replace('<<TRAIT_SOFTDELETE>>', ', SoftDeletes');
        }

        // 3, 4, & 5. Handle Auditing
        if (projectSettings.module_log_audit === 1) {
            const importAudit = `use OwenIt\\Auditing\\Contracts\\Auditable;\nuse OwenIt\\Auditing\\Auditable as AuditableTrait;`;
            userModelContent = userModelContent.replace('<<IMPORT_AUDIT>>', importAudit);
            userModelContent = userModelContent.replace('<<CLASS_IMPLEMENTS_AUDIT>>', 'implements Auditable');
            userModelContent = userModelContent.replace('<<TRAIT_AUDIT>>', ', AuditableTrait');
        }

        // Handle Authorization (Spatie/Permission/Shield)
        if (projectSettings.module_authorization === 1) {
            userModelContent = userModelContent.replace('<<IMPORT_SHIELD>>', 'use Spatie\\Permission\\Traits\\HasRoles;');
            userModelContent = userModelContent.replace('<<TRAIT_SHIELD>>', ', HasRoles');
        }

        // 10. Ganti Fungsi Hubungan (Eloquent Relationships)
        let relationshipFunctions = [];
        const tableName = 'users';

        // Mencari hubungan di mana 'users' adalah PARENT (hasOne / hasMany)
        relationships.filter(r => r.parent_table_name === tableName).forEach(rel => {
            const childClassName = toSingularPascalCase(rel.child_table_name);
            const foreignKey = rel.fk_child_field;
            const localKey = rel.parent_field;

            if (rel.relationship_type === 'one-to-one') {
                const functionName = toSingularCamelCase(rel.child_table_name); // Singular
                relationshipFunctions.push(`
    public function ${functionName}()
    {
        return $this->hasOne(${childClassName}::class, '${foreignKey}', '${localKey}');
    }
`);
            } else {
                const functionName = toPluralCamelCase(rel.child_table_name); // Plural
                relationshipFunctions.push(`
    public function ${functionName}()
    {
        return $this->hasMany(${childClassName}::class, '${foreignKey}', '${localKey}');
    }
`);
            }
        });

        // Mencari hubungan di mana 'users' adalah CHILD (belongsTo)
        relationships.filter(r => r.child_table_name === tableName).forEach(rel => {
            const parentClassName = toSingularPascalCase(rel.parent_table_name);
            const functionName = toSingularCamelCase(rel.parent_table_name); // Singular
            relationshipFunctions.push(`
    public function ${functionName}()
    {
        return $this->belongsTo(${parentClassName}::class, '${rel.fk_child_field}', '${rel.parent_field}');
    }
`);
        });

        userModelContent = userModelContent.replace('<<RELATIONSHIP_FUNCTIONS>>', relationshipFunctions.join(''));
// Bersihkan placeholder yang tidak digunakan dan baris kosong yang terhasil
        userModelContent = userModelContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, ''); // Buang placeholder pada baris sendiri
        userModelContent = userModelContent.replace(/<<.*?>>/g, ''); // Buang placeholder dalam baris (inline)

        // 11. Jana fail output
        const outputFilePath = path.join(basePath, 'app', 'Models', 'User.php');
        fs.writeFileSync(outputFilePath, userModelContent);
        console.log(`User Model generated: ${outputFilePath}`);
        
        return { success: true, message: 'User Model generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament User Model:', error);
        return { success: false, message: error.message };
    }
}

async function generateLaravelMigrations(fullSchema, outputBasePath) {
    try {
        const { database: { table: tables, relationships } } = fullSchema;
        const migrationsPath = path.join(outputBasePath, 'database', 'migrations');

        if (!fs.existsSync(migrationsPath)) {
            fs.mkdirSync(migrationsPath, { recursive: true });
        }

        let now = new Date();
        let sequence = 0;

        // --- FASA 1: CREATE TABLES ---
        for (const tableName in tables) {
            if (['migrations', 'jobs', 'failed_jobs', 'sessions', 'password_reset_tokens', 'cache', 'users'].includes(tableName)) continue;

            const tableData = tables[tableName];
            sequence++;
            const timestamp = getFormattedTimestamp(now, sequence);
            const fileName = `${timestamp}_create_${tableName}_table.php`;
            
            const fieldsArr = Object.values(tableData.fields);
            const pkField = fieldsArr.find(f => f.primary_key === 1);
            
            const ignoredFields = ['created_at', 'updated_at', 'deleted_at'];
            if (pkField) ignoredFields.push(pkField.field_name);

            const regularFields = fieldsArr
                .filter(f => !ignoredFields.includes(f.field_name))
                .sort((a, b) => (a.field_order || 999) - (b.field_order || 999));

            let content = `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('${tableName}', function (Blueprint $table) {
`;

            // PK
            if (pkField) {
                if (['INT', 'INTEGER', 'BIGINT', 'TINYINT'].includes(pkField.data_type.toUpperCase())) {
                    content += pkField.field_name === 'id' ? `            $table->id();\n` : `            $table->id('${pkField.field_name}');\n`;
                } else {
                    content += `            $table->string('${pkField.field_name}')->primary();\n`;
                }
            }

            // Fields
            regularFields.forEach(field => {
                const isForeignKey = relationships.some(r => r.child_table_name === tableName && r.fk_child_field === field.field_name);
                let line = '';
                const upperType = field.data_type ? field.data_type.toUpperCase() : 'VARCHAR';

                if (isForeignKey && ['INT', 'INTEGER', 'BIGINT'].includes(upperType)) {
                    line = `            $table->foreignId('${field.field_name}')`;
                } else if (['VARCHAR', 'STRING', 'CHAR'].includes(upperType)) {
                    const method = upperType === 'CHAR' ? 'char' : 'string';
                    const lengthParam = (field.length && parseInt(field.length) > 0) ? `, ${field.length}` : '';
                    line = `            $table->${method}('${field.field_name}'${lengthParam})`;
                } else {
                    line = `            ${getFieldDefinitionForMigration(field)}`;
                }

                // Not Null Logic
                if (field.not_null !== undefined && field.not_null !== null) {
                    if (Number(field.not_null) === 0) line += `->nullable()`;
                } else {
                    if (field.is_nullable === 1) line += `->nullable()`;
                }

                // Default
                if (field.default_value) {
                    if (field.default_value.toUpperCase() === 'CURRENT_TIMESTAMP') line += `->useCurrent()`;
                    else line += `->default('${field.default_value}')`;
                }

                // Unique (Single)
                if (field.is_unique === 1 || field.unique === 1) line += `->unique()`;

                content += `${line};\n`;
            });

            // Unique (Composite / Table Constraints)
            if (tableData.constraints && tableData.constraints.length > 0) {
                tableData.constraints.forEach(constraint => {
                    if (constraint.constraint_type === 'UNIQUE') {
                        try {
                            const columns = JSON.parse(constraint.columns);
                            if (Array.isArray(columns) && columns.length > 0) {
                                const columnsPhp = "['" + columns.join("', '") + "']";
                                content += `            $table->unique(${columnsPhp});\n`;
                            }
                        } catch (e) {}
                    }
                });
            }

            content += `            $table->timestamps();\n`;
            if (tableData.soft_deletes === 1) content += `            $table->softDeletes();\n`;
            content += `        });\n    }\n\n    public function down(): void\n    {\n        Schema::dropIfExists('${tableName}');\n    }\n};`;

            fs.writeFileSync(path.join(migrationsPath, fileName), content);
        }

        // --- FASA 2: FOREIGN KEYS ---
        sequence += 20;
        for (const tableName in tables) {
            if (tableName === 'users') continue;
            const childRels = relationships.filter(r => r.child_table_name === tableName);
            if (childRels.length === 0) continue;

            sequence++;
            const timestamp = getFormattedTimestamp(now, sequence);
            const fileName = `${timestamp}_add_foreign_keys_to_${tableName}_table.php`;

            let content = `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('${tableName}', function (Blueprint $table) {
`;
            childRels.forEach(rel => {
                const onDelete = rel.on_delete && rel.on_delete.toLowerCase() !== 'no action' ? rel.on_delete.toLowerCase() : null;
                const onUpdate = rel.on_update && rel.on_update.toLowerCase() !== 'no action' ? rel.on_update.toLowerCase() : null;
                
                let line = `            $table->foreign(['${rel.fk_child_field}'])->references(['id'])->on('${rel.parent_table_name}')`;
                if (onUpdate) line += `->onUpdate('${onUpdate}')`;
                if (onDelete) line += `->onDelete('${onDelete}')`;
                content += `${line};\n`;
            });

            content += `        });\n    }\n\n    public function down(): void\n    {\n        Schema::table('${tableName}', function (Blueprint $table) {\n`;
            childRels.forEach(rel => {
                content += `            $table->dropForeign(['${rel.fk_child_field}']);\n`;
            });
            content += `        });\n    }\n};`;
            fs.writeFileSync(path.join(migrationsPath, fileName), content);
        }

        return { success: true, message: 'Migrations generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function generateLaravelFactories(fullSchema, basePath) {
    try {
        const { database: { table: tables, relationships } } = fullSchema;
        const factoriesPath = path.join(basePath, 'database', 'factories');
        
        if (!fs.existsSync(factoriesPath)) fs.mkdirSync(factoriesPath, { recursive: true });

        for (const tableName in tables) {
            if (tableName === 'users') continue;

            const tableData = tables[tableName];
            const modelName = toSingularPascalCase(tableName);
            const className = `${modelName}Factory`;
            
            const columns = [];
            const fieldsArr = Object.values(tableData.fields);
            
            fieldsArr.forEach(field => {
                if (field.primary_key === 1) return;
                if (['created_at', 'updated_at', 'deleted_at'].includes(field.field_name)) return;
                const isForeignKey = relationships.some(r => r.child_table_name === tableName && r.fk_child_field === field.field_name);
                if (isForeignKey) return; // Seeder will handle

                columns.push(`            '${field.field_name}' => ${getFakerFormatter(field)},`);
            });

            const content = `<?php

namespace Database\\Factories;

use Illuminate\\Database\\Eloquent\\Factories\\Factory;
use App\\Models\\${modelName};

/**
 * @extends \\Illuminate\\Database\\Eloquent\\Factories\\Factory<\\App\\Models\\${modelName}>
 */
class ${className} extends Factory
{
    protected $model = ${modelName}::class;

    public function definition(): array
    {
        return [
${columns.join('\n')}
        ];
    }
}
`;
            fs.writeFileSync(path.join(factoriesPath, `${className}.php`), content);
        }
        return { success: true, message: 'Factories generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function generateLaravelDatabaseSeeder(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;
        const seedersPath = path.join(basePath, 'database', 'seeders');
        if (!fs.existsSync(seedersPath)) fs.mkdirSync(seedersPath, { recursive: true });

        // Topological Sort
        let tableNames = Object.keys(tables).filter(t => t !== 'users'); 
        let sortedTables = [];
        let visited = new Set();
        let tempVisited = new Set();

        const visit = (table) => {
            if (tempVisited.has(table)) return; 
            if (visited.has(table)) return;
            tempVisited.add(table);
            const parents = relationships.filter(r => r.child_table_name === table && r.parent_table_name !== table).map(r => r.parent_table_name);
            parents.forEach(parent => { if (tableNames.includes(parent)) visit(parent); });
            tempVisited.delete(table);
            visited.add(table);
            sortedTables.push(table);
        };
        tableNames.forEach(table => visit(table));

        let importStatements = [`use App\\Models\\User;`];
        let runContent = [];

        runContent.push(`        // 1. Create Test User`);
        runContent.push(`        User::factory()->create(['name' => 'Test User', 'email' => 'admin@admin.com', 'password' => bcrypt('password')]);`);

        sortedTables.forEach(tableName => {
            const modelName = toSingularPascalCase(tableName);
            importStatements.push(`use App\\Models\\${modelName};`);
            const tableData = tables[tableName];
            const myRelationships = relationships.filter(r => r.child_table_name === tableName);
            
            // Check Constraints
            const oneToOneRel = myRelationships.find(rel => {
                const field = tableData.fields[rel.fk_child_field];
                return field && (field.unique === 1 || field.is_unique === 1);
            });

            let compositeUniqueRel = null;
            if (tableData.constraints) {
                const uniqueConstraint = tableData.constraints.find(c => c.constraint_type === 'UNIQUE');
                if (uniqueConstraint) {
                    try {
                        const cols = JSON.parse(uniqueConstraint.columns);
                        const fks = myRelationships.filter(r => cols.includes(r.fk_child_field));
                        if (fks.length >= 2) compositeUniqueRel = { constraint_cols: cols, relationships: fks };
                    } catch (e) {}
                }
            }

            runContent.push(`\n        // Seed: ${tableName}`);

            if (oneToOneRel) {
                const parentModel = toSingularPascalCase(oneToOneRel.parent_table_name);
                const method = toSingularCamelCase(tableName); 
                runContent.push(`        $parents = ${parentModel}::doesntHave('${method}')->take(20)->get();`);
                runContent.push(`        foreach($parents as $parent) {`);
                runContent.push(`            ${modelName}::factory()->create(['${oneToOneRel.fk_child_field}' => $parent->id]);`);
                runContent.push(`        }`);
            } else if (compositeUniqueRel) {
                const relA = compositeUniqueRel.relationships[0];
                const relB = compositeUniqueRel.relationships[1];
                const modelA = toSingularPascalCase(relA.parent_table_name);
                const modelB = toSingularPascalCase(relB.parent_table_name);
                
                runContent.push(`        $listA = ${modelA}::all();`);
                runContent.push(`        $listB = ${modelB}::pluck('id');`);
                runContent.push(`        foreach($listA as $itemA) {`);
                runContent.push(`            $randomB = $listB->random(min(3, $listB->count()));`);
                runContent.push(`            foreach($randomB as $idB) {`);
                runContent.push(`                try { ${modelName}::factory()->create(['${relA.fk_child_field}' => $itemA->id, '${relB.fk_child_field}' => $idB]); } catch (\\Exception $e) { continue; }`);
                runContent.push(`            }`);
                runContent.push(`        }`);
            } else {
                if (myRelationships.length === 0) {
                    runContent.push(`        ${modelName}::factory(10)->create();`);
                } else {
                    let overrides = [];
                    myRelationships.forEach(rel => {
                        const parentModel = toSingularPascalCase(rel.parent_table_name);
                        const fkField = rel.fk_child_field;
                        if (rel.parent_table_name === 'users') overrides.push(`            '${fkField}' => 1`);
                        else overrides.push(`            '${fkField}' => ${parentModel}::inRandomOrder()->first()?->id ?? null`);
                    });
                    runContent.push(`        ${modelName}::factory(20)->create([\n${overrides.join(',\n')}\n        ]);`);
                }
            }
        });

        if (projectSettings.module_authorization === 1) {
            runContent.push(`\n        // Filament Shield Security`);
            runContent.push(`        $this->call(ShieldSeeder::class);`);
        }

        const content = `<?php
namespace Database\\Seeders;
use Illuminate\\Database\\Seeder;
${importStatements.join('\n')}

class DatabaseSeeder extends Seeder {
    public function run(): void {
${runContent.join('\n')}
    }
}`;
        fs.writeFileSync(path.join(seedersPath, 'DatabaseSeeder.php'), content);
        return { success: true, message: 'DatabaseSeeder generated successfully.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Export functions untuk digunakan di main.js
module.exports = {
    generateFilamentModels,
    generateFilamentUserModel,
    generateLaravelMigrations,
    generateLaravelFactories,
    generateLaravelDatabaseSeeder
};