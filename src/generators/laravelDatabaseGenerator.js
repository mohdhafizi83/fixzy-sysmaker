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
    readTemplate,
    toPascalCase // Ditambah
} = require('../utils');

// ========================================================================
// HELPER: LOGIK PENAMAAN (MODULE NAME vs TABLE NAME)
// ========================================================================

/**
 * Mendapatkan Nama Model (Class Name) berdasarkan Module Name (jika ada).
 */
function getModelClassName(tableName, tables) {
    if (tableName === 'users') return 'User';
    const tableData = tables[tableName];
    if (!tableData) return toSingularPascalCase(tableName);

    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                        ? tableData.module_name 
                        : tableName;
    return toSingularPascalCase(nameSource);
}

/**
 * Mendapatkan Nama Fungsi Relation berdasarkan Module Name.
 */
function getRelationFunctionName(tableName, tables, isPlural = false) {
    if (tableName === 'users') return isPlural ? 'users' : 'user';
    const tableData = tables[tableName];
    if (!tableData) return isPlural ? toPluralCamelCase(tableName) : toSingularCamelCase(tableName);

    const nameSource = (tableData.module_name && tableData.module_name.trim() !== '') 
                        ? tableData.module_name 
                        : tableName;
    
    return isPlural ? toPluralCamelCase(nameSource) : toSingularCamelCase(nameSource);
}


/**
 * Menjana fail Model Laravel Filament berdasarkan skema pangkalan data.
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
            
            // Logik Traits (SoftDelete, Factory, Audit)
            if (projectSettings.module_fake_data === 1) modelContent = modelContent.replace('<<IMPORT_FACTORY>>', 'use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;').replace('<<TRAIT_FACTORY>>', 'use HasFactory;');
            else modelContent = modelContent.replace('<<IMPORT_FACTORY>>', '').replace('<<TRAIT_FACTORY>>', '');

            if (projectSettings.data_delete_type === 'soft') modelContent = modelContent.replace('<<IMPORT_SOFTDELETE>>', 'use Illuminate\\Database\\Eloquent\\SoftDeletes;').replace('<<TRAIT_SOFTDELETE>>', 'use SoftDeletes;');
            else modelContent = modelContent.replace('<<IMPORT_SOFTDELETE>>', '').replace('<<TRAIT_SOFTDELETE>>', '');

            if (projectSettings.module_log_audit === 1) {
                const importAudit = `use OwenIt\\Auditing\\Contracts\\Auditable;\nuse OwenIt\\Auditing\\Auditable as AuditableTrait;`;
                modelContent = modelContent.replace('<<IMPORT_AUDIT>>', importAudit).replace('<<CLASS_IMPLEMENTS_AUDIT>>', 'implements Auditable').replace('<<TRAIT_AUDIT>>', 'use AuditableTrait;');
            } else {
                modelContent = modelContent.replace('<<IMPORT_AUDIT>>', '').replace('<<CLASS_IMPLEMENTS_AUDIT>>', '').replace('<<TRAIT_AUDIT>>', '');
            }
            
            // --- 1. Tentukan Nama Kelas (Guna Module Name) ---
            const className = getModelClassName(tableName, tables);
            modelContent = modelContent.replace(/<<CLASS_NAME>>/g, className);
            
            // --- 2. Tentukan Table Name Sebenar (Untuk properti protected $table) ---
            // Template mesti ada: protected $table = '<<TABLE_NAME>>';
            modelContent = modelContent.replace('<<TABLE_NAME>>', tableName);

            // Setup Fields
            const primaryKeyField = Object.values(tableData.fields).find(f => f.primary_key === 1);
            modelContent = modelContent.replace('<<PRIMARY_KEY>>', primaryKeyField ? primaryKeyField.field_name : 'id');
            
            const excludedFields = ['created_at', 'updated_at', 'deleted_at', primaryKeyField?.field_name];
            const fillableFields = Object.values(tableData.fields).filter(field => !excludedFields.includes(field.field_name) && field.read_only !== 1).map(field => `\n        '${field.field_name}'`).join(',');
            modelContent = modelContent.replace('<<ARRAY_EDITABLE_BYUSER_FIELDS>>', fillableFields ? `${fillableFields}\n    ` : '');
            
            // Casts
            const castableFields = Object.values(tableData.fields).filter(field => 
                field.data_type === 'JSON' || 
                (field.data_type === 'BOOLEAN' && field.display_type === 'check_box')
            );
            
            if (castableFields.length > 0) {
                const castLines = castableFields.map(field => {
                    let castType = '';
                    if (field.data_type === 'JSON') castType = 'array';
                    else if (field.data_type === 'BOOLEAN' && field.display_type === 'check_box') castType = 'boolean';
                    return `\n        '${field.field_name}' => '${castType}',`;
                }).join('');
                modelContent = modelContent.replace('<<MODEL_CASTS>>', `\n    protected \$casts = [${castLines}\n    ];`);
            } else {
                modelContent = modelContent.replace('<<MODEL_CASTS>>', '');
            }

            // ▼▼▼ BLOK HUBUNGAN (DIKEMASKINI GUNA MODULE NAME) ▼▼▼
            let relationshipFunctions = [];

            // A. Hubungan PARENT (Model ini ada hasMany/hasOne ke Child)
            relationships.filter(r => r.parent_table_name === tableName).forEach(rel => {
                const childClassName = getModelClassName(rel.child_table_name, tables);
                const foreignKey = rel.fk_child_field; // Nama column sebenar di DB
                const localKey = rel.parent_field;     // Nama column sebenar di DB
                let functionName;

                if (rel.parent_table_name === rel.child_table_name) {
                    // Self-referencing (Parent -> Children)
                    functionName = 'children'; 
                } else {
                    // Guna Module Name untuk nama function (cth: studentInfos)
                    functionName = getRelationFunctionName(rel.child_table_name, tables, true); 
                    // Jika One-to-One, guna Singular
                    if (rel.relationship_type === 'one-to-one') {
                         functionName = getRelationFunctionName(rel.child_table_name, tables, false);
                    }
                }

                if (rel.relationship_type === 'one-to-one') {
                    // Jika self-ref singular
                    if (rel.parent_table_name === rel.child_table_name) functionName = 'child'; 
                    relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return \$this->hasOne(${childClassName}::class, '${foreignKey}', '${localKey}');\n    }`);
                } else {
                    relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return \$this->hasMany(${childClassName}::class, '${foreignKey}', '${localKey}');\n    }`);
                }
            });

            // B. Hubungan CHILD (Model ini belongsTo Parent)
            relationships.filter(r => r.child_table_name === tableName).forEach(rel => {
                const parentClassName = getModelClassName(rel.parent_table_name, tables);
                const foreignKey = rel.fk_child_field;
                const ownerKey = rel.parent_field;
                let functionName;

                if (rel.parent_table_name === rel.child_table_name) {
                    // Self-referencing (Child -> Parent)
                    functionName = 'parent'; 
                } else {
                    // Guna Module Name (cth: department)
                    functionName = getRelationFunctionName(rel.parent_table_name, tables, false);
                }
                
                relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return \$this->belongsTo(${parentClassName}::class, '${foreignKey}', '${ownerKey}');\n    }`);
            });
            // ▲▲▲ TAMAT BLOK UBAH SUAI ▲▲▲

            modelContent = modelContent.replace('<<RELATIONSHIP_FUNCTIONS>>', relationshipFunctions.join(''));
            
            // Helper Methods (Accessors & Youtube)
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

// --- MULA: LOGIK USERSTAMPS & TENANCY (BOOT METHOD) ---
            const hasCreatedBy = Object.values(tableData.fields).some(f => f.field_name === 'created_by');
            const hasUpdatedBy = Object.values(tableData.fields).some(f => f.field_name === 'updated_by');
            const hasDeletedBy = Object.values(tableData.fields).some(f => f.field_name === 'deleted_by');

            // Kesan FK Tenant (untuk one_to_many)
            const isOneToMany = projectSettings.tenancy_type === 'one_to_many';
            const tenantTable = projectSettings.tenant_table;
            let tenantFkField = null;

            if (isOneToMany && tenantTable && tableName !== tenantTable && tableName !== 'users') {
                const tenantRel = relationships.find(r => r.parent_table_name === tenantTable && r.child_table_name === tableName);
                if (tenantRel) tenantFkField = tenantRel.fk_child_field;
                else {
                    const fallbackFk = toSingularCamelCase(tenantTable) + '_id';
                    if (Object.values(tableData.fields).some(f => f.field_name === fallbackFk)) tenantFkField = fallbackFk;
                    else if (Object.values(tableData.fields).some(f => f.field_name === tenantTable + '_id')) tenantFkField = tenantTable + '_id';
                }
            }

            if (hasCreatedBy || hasUpdatedBy || hasDeletedBy || tenantFkField) {
                let bootMethodContent = `\n    protected static function boot()\n    {\n        parent::boot();\n`;
                
                if (hasCreatedBy || hasUpdatedBy || tenantFkField) {
                    bootMethodContent += `\n        static::creating(function ($model) {`;
                    
                    // Suntik nilai tenant_id secara automatik
                    if (tenantFkField) {
                        bootMethodContent += `\n            if (empty($model->${tenantFkField}) && auth()->check()) {\n                $model->${tenantFkField} = auth()->user()->${tenantFkField};\n            }`;
                    }
                    if (hasCreatedBy) {
                        bootMethodContent += `\n            if (empty($model->created_by)) {\n                $model->created_by = auth()->id();\n            }`;
                    }
                    if (hasUpdatedBy) {
                        bootMethodContent += `\n            if (empty($model->updated_by)) {\n                $model->updated_by = auth()->id();\n            }`;
                    }
                    bootMethodContent += `\n        });\n`;
                }

                if (hasUpdatedBy) {
                    bootMethodContent += `\n        static::updating(function ($model) {\n            $model->updated_by = auth()->id();\n        });\n`;
                }

                if (hasDeletedBy && projectSettings.data_delete_type === 'soft') {
                    bootMethodContent += `\n        static::deleting(function ($model) {\n            $model->deleted_by = auth()->id();\n            $model->saveQuietly(); // Guna saveQuietly elak trigger event updating\n        });\n`;
                }
                
                bootMethodContent += `    }\n`;
                helperMethods.push(bootMethodContent); // Masukkan ke dalam array helperMethods
            }
            // --- TAMAT LOGIK USERSTAMPS ---

            // Cantumkan semua function (Youtube + Boot) dan masukkan ke placeholder template
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
 */
async function generateFilamentUserModel(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;
        const userData = tables.users;

        if (!userData) {
            console.warn("Skema untuk jadual 'users' tidak ditemui. Melangkau penjanaan User.php.");
            return { success: true, message: 'User model skipped.' };
        }

        const templateContent = readTemplate('app/Models/User.template');
        let userModelContent = templateContent;

        // --- KEKAL 100% LOGIK ASAL ANDA ---
        if (projectSettings.data_delete_type === 'soft') {
            userModelContent = userModelContent.replace('<<IMPORT_SOFTDELETE>>', 'use Illuminate\\Database\\Eloquent\\SoftDeletes;');
            userModelContent = userModelContent.replace('<<TRAIT_SOFTDELETE>>', ', SoftDeletes');
        } else {
             userModelContent = userModelContent.replace('<<IMPORT_SOFTDELETE>>', '').replace('<<TRAIT_SOFTDELETE>>', '');
        }

        if (projectSettings.module_log_audit === 1) {
            const importAudit = `use OwenIt\\Auditing\\Contracts\\Auditable;\nuse OwenIt\\Auditing\\Auditable as AuditableTrait;`;
            userModelContent = userModelContent.replace('<<IMPORT_AUDIT>>', importAudit);
            userModelContent = userModelContent.replace('<<CLASS_IMPLEMENTS_AUDIT>>', 'implements Auditable');
            userModelContent = userModelContent.replace('<<TRAIT_AUDIT>>', ', AuditableTrait');
        } else {
             userModelContent = userModelContent.replace('<<IMPORT_AUDIT>>', '').replace('<<CLASS_IMPLEMENTS_AUDIT>>', '').replace('<<TRAIT_AUDIT>>', '');
        }

        if (projectSettings.module_authorization === 1) {
            userModelContent = userModelContent.replace('<<IMPORT_SHIELD>>', 'use Spatie\\Permission\\Traits\\HasRoles;');
            userModelContent = userModelContent.replace('<<TRAIT_SHIELD>>', ', HasRoles');
        } else {
             userModelContent = userModelContent.replace('<<IMPORT_SHIELD>>', '').replace('<<TRAIT_SHIELD>>', '');
        }

        // --- MULA: LOGIK IMPORT TENANCY UNTUK USER (DIKEMASKINI) ---
        if (projectSettings.tenancy_type === 'many_to_many' && projectSettings.tenant_table) {
            const importTenant = `use Filament\\Models\\Contracts\\HasTenants;\nuse Illuminate\\Support\\Collection;\nuse Illuminate\\Database\\Eloquent\\Model;\nuse Filament\\Panel;\nuse Illuminate\\Database\\Eloquent\\Relations\\BelongsToMany;`;
            userModelContent = userModelContent.replace('<<IMPORT_TENANT>>', importTenant);
            
            // Pastikan tiada ralat sintaks (, HasTenants) jika Audit off
            const implementsStr = (projectSettings.module_log_audit === 1) ? ', HasTenants' : 'implements HasTenants';
            userModelContent = userModelContent.replace('<<CLASS_IMPLEMENTS_TENANT>>', implementsStr);
        } else {
            userModelContent = userModelContent.replace('<<IMPORT_TENANT>>', '');
            userModelContent = userModelContent.replace('<<CLASS_IMPLEMENTS_TENANT>>', '');
        }
        // --- TAMAT LOGIK IMPORT TENANCY ---

        // ▼▼▼ HUBUNGAN USER GUNA MODULE NAME (KEKAL 100% ASAL) ▼▼▼
        let relationshipFunctions = [];
        const tableName = 'users';

        relationships.filter(r => r.parent_table_name === tableName).forEach(rel => {
            const childClassName = getModelClassName(rel.child_table_name, tables);
            const foreignKey = rel.fk_child_field;
            const localKey = rel.parent_field;

            if (rel.relationship_type === 'one-to-one') {
                const functionName = getRelationFunctionName(rel.child_table_name, tables, false);
                relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return $this->hasOne(${childClassName}::class, '${foreignKey}', '${localKey}');\n    }\n`);
            } else {
                const functionName = getRelationFunctionName(rel.child_table_name, tables, true);
                relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return $this->hasMany(${childClassName}::class, '${foreignKey}', '${localKey}');\n    }\n`);
            }
        });

        relationships.filter(r => r.child_table_name === tableName).forEach(rel => {
            const parentClassName = getModelClassName(rel.parent_table_name, tables);
            const functionName = getRelationFunctionName(rel.parent_table_name, tables, false);
            relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return $this->belongsTo(${parentClassName}::class, '${rel.fk_child_field}', '${rel.parent_field}');\n    }\n`);
        });
        
        // --- MULA: FUNGSI WAJIB FILAMENT TENANCY (DIKEMASKINI UNTUK PIVOT) ---
        if (projectSettings.tenancy_type === 'many_to_many' && projectSettings.tenant_table) {
            const tenantModelName = getModelClassName(projectSettings.tenant_table, tables);
            const relationName = getRelationFunctionName(projectSettings.tenant_table, tables, true);
            const pivotTable = `${projectSettings.tenant_table}_user`;
            
            relationshipFunctions.push(`
    public function ${relationName}(): BelongsToMany
    {
        return $this->belongsToMany(\\App\\Models\\${tenantModelName}::class, '${pivotTable}');
    }

    public function getTenants(Panel $panel): array|Collection
    {
        return $this->${relationName};
    }

    public function canAccessTenant(Model $tenant): bool
    {
        return $this->${relationName}()->whereKey($tenant)->exists();
    }
`);
        }
        // --- TAMAT FUNGSI WAJIB TENANCY ---
        // ▲▲▲ TAMAT HUBUNGAN USER ▲▲▲

        userModelContent = userModelContent.replace('<<RELATIONSHIP_FUNCTIONS>>', relationshipFunctions.join(''));
        userModelContent = userModelContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
        userModelContent = userModelContent.replace(/<<.*?>>/g, '');

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
        // ▼▼▼ PEMBAIKAN 1: Panggil project (projectSettings) dari fullSchema ▼▼▼
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;
        const migrationsPath = path.join(outputBasePath, 'database', 'migrations');
        if (!fs.existsSync(migrationsPath)) fs.mkdirSync(migrationsPath, { recursive: true });

        let now = new Date();
        let sequence = 0;

        for (const tableName in tables) {
            if (['migrations', 'jobs', 'failed_jobs', 'sessions', 'password_reset_tokens', 'cache', 'users'].includes(tableName)) continue;
            const tableData = tables[tableName];
            sequence++;
            const timestamp = getFormattedTimestamp(now, sequence);
            const fileName = `${timestamp}_create_${tableName}_table.php`;
            const fieldsArr = Object.values(tableData.fields);
            const pkField = fieldsArr.find(f => f.primary_key === 1);
            // Tambah created_by, updated_by, deleted_by ke dalam senarai yang diabaikan (untuk diuruskan secara manual di bawah)
            const ignoredFields = ['created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by'];
            if (pkField) ignoredFields.push(pkField.field_name);
            const regularFields = fieldsArr.filter(f => !ignoredFields.includes(f.field_name)).sort((a, b) => (a.field_order || 999) - (b.field_order || 999));
            
            let content = `<?php\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n    public function up(): void\n    {\n        Schema::create('${tableName}', function (Blueprint $table) {\n`;
            if (pkField) {
                if (['INT', 'INTEGER', 'BIGINT', 'TINYINT'].includes(pkField.data_type.toUpperCase())) {
                    content += pkField.field_name === 'id' ? `            $table->id();\n` : `            $table->id('${pkField.field_name}');\n`;
                } else {
                    content += `            $table->string('${pkField.field_name}')->primary();\n`;
                }
            }
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
                if (field.not_null !== undefined && field.not_null !== null) { if (Number(field.not_null) === 0) line += `->nullable()`; } else { if (field.is_nullable === 1) line += `->nullable()`; }
                if (field.default_value) { if (field.default_value.toUpperCase() === 'CURRENT_TIMESTAMP') line += `->useCurrent()`; else line += `->default('${field.default_value}')`; }
                if (field.is_unique === 1 || field.unique === 1) line += `->unique()`;
                content += `${line};\n`;
            });
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

// --- MULA: LOGIK MIGRASI USERSTAMPS ---
            const hasCreatedBy = fieldsArr.some(f => f.field_name === 'created_by');
            const hasUpdatedBy = fieldsArr.some(f => f.field_name === 'updated_by');
            const hasDeletedBy = fieldsArr.some(f => f.field_name === 'deleted_by');

            // Kita letakkan ia sebagai nullable() supaya Seeder / proses sistem (tanpa auth) tidak crash
            if (hasCreatedBy) content += `            $table->unsignedBigInteger('created_by')->nullable();\n`;
            if (hasUpdatedBy) content += `            $table->unsignedBigInteger('updated_by')->nullable();\n`;
            
            // Sentiasa jana deleted_by (jika wujud dalam table) tidak kira jenis delete
            if (hasDeletedBy) content += `            $table->unsignedBigInteger('deleted_by')->nullable();\n`;
            // --- TAMAT LOGIK MIGRASI USERSTAMPS ---

            content += `            $table->timestamps();\n`;
            
            // ▼▼▼ PEMBAIKAN 2: Guna global projectSettings untuk Soft Deletes ▼▼▼
            if (projectSettings && projectSettings.data_delete_type === 'soft') {
                 content += `            $table->softDeletes();\n`;
            }
content += `        });\n    }\n\n    public function down(): void\n    {\n        Schema::dropIfExists('${tableName}');\n    }\n};`;
            fs.writeFileSync(path.join(migrationsPath, fileName), content);
        }

        // --- MULA: AUTO-JANA PIVOT TABLE UNTUK MANY-TO-MANY TENANCY ---
        if (projectSettings && projectSettings.tenancy_type === 'many_to_many' && projectSettings.tenant_table) {
            const tenantTable = projectSettings.tenant_table;
            const tenantSingular = toSingularCamelCase(tenantTable);
            const pivotTable = `${tenantSingular}_user`;
            
            // Jana file migrasi hanya jika user belum membinanya secara manual
            if (!tables[pivotTable] && !tables[`user_${tenantSingular}`]) {
                sequence++;
                const timestamp = getFormattedTimestamp(now, sequence);
                const fileName = `${timestamp}_create_${pivotTable}_table.php`;
                
                let content = `<?php\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n    public function up(): void\n    {\n        Schema::create('${pivotTable}', function (Blueprint $table) {\n`;
                content += `            $table->id();\n`;
                
                // Cari Primary Key bagi Tenant Table (Biasanya 'id')
                const tenantPk = tables[tenantTable] ? (Object.values(tables[tenantTable].fields).find(f => f.primary_key === 1)?.field_name || 'id') : 'id';
                
                content += `            $table->foreignId('${tenantSingular}_id')->constrained('${tenantTable}', '${tenantPk}')->cascadeOnDelete();\n`;
                content += `            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();\n`;
                content += `            $table->timestamps();\n`;
                content += `        });\n    }\n\n    public function down(): void\n    {\n        Schema::dropIfExists('${pivotTable}');\n    }\n};`;
                
                fs.writeFileSync(path.join(migrationsPath, fileName), content);
                console.log(`Pivot Table Migration generated: ${fileName}`);
            }
        }
        // --- TAMAT AUTO-JANA PIVOT TABLE ---

        sequence += 20;
        for (const tableName in tables) {
            if (tableName === 'users') continue;
            const childRels = relationships.filter(r => r.child_table_name === tableName);
            if (childRels.length === 0) continue;
            sequence++;
            const timestamp = getFormattedTimestamp(now, sequence);
            const fileName = `${timestamp}_add_foreign_keys_to_${tableName}_table.php`;
            let content = `<?php\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n    public function up(): void\n    {\n        Schema::table('${tableName}', function (Blueprint $table) {\n`;
            childRels.forEach(rel => {
                const onDelete = rel.on_delete && rel.on_delete.toLowerCase() !== 'no action' ? rel.on_delete.toLowerCase() : null;
                const onUpdate = rel.on_update && rel.on_update.toLowerCase() !== 'no action' ? rel.on_update.toLowerCase() : null;
                let line = `            $table->foreign(['${rel.fk_child_field}'])->references(['id'])->on('${rel.parent_table_name}')`;
                if (onUpdate) line += `->onUpdate('${onUpdate}')`;
                if (onDelete) line += `->onDelete('${onDelete}')`;
                content += `${line};\n`;
            });
            content += `        });\n    }\n\n    public function down(): void\n    {\n        Schema::table('${tableName}', function (Blueprint $table) {\n`;
            childRels.forEach(rel => { content += `            $table->dropForeign(['${rel.fk_child_field}']);\n`; });
            content += `        });\n    }\n};`;
            fs.writeFileSync(path.join(migrationsPath, fileName), content);
        }
        return { success: true, message: 'Migrations generated successfully.' };
    } catch (error) { return { success: false, message: error.message }; }
}

async function generateLaravelFactories(fullSchema, basePath) {
    try {
        const { database: { table: tables, relationships } } = fullSchema;
        const factoriesPath = path.join(basePath, 'database', 'factories');
        if (!fs.existsSync(factoriesPath)) fs.mkdirSync(factoriesPath, { recursive: true });

        for (const tableName in tables) {
            if (tableName === 'users') continue;
            const tableData = tables[tableName];
            
            // UPDATE: Guna Module Name untuk Factory Class Name
            const modelName = getModelClassName(tableName, tables);
            const className = `${modelName}Factory`;
            
            const columns = [];
            const fieldsArr = Object.values(tableData.fields);
            fieldsArr.forEach(field => {
                if (field.primary_key === 1) return;
                if (['created_at', 'updated_at', 'deleted_at'].includes(field.field_name)) return;
                const isForeignKey = relationships.some(r => r.child_table_name === tableName && r.fk_child_field === field.field_name);
                if (isForeignKey) return;
                columns.push(`            '${field.field_name}' => ${getFakerFormatter(field)},`);
            });

            const content = `<?php\nnamespace Database\\Factories;\nuse Illuminate\\Database\\Eloquent\\Factories\\Factory;\nuse App\\Models\\${modelName};\n\n/**\n * @extends \\Illuminate\\Database\\Eloquent\\Factories\\Factory<\\App\\Models\\${modelName}>\n */\nclass ${className} extends Factory\n{\n    protected $model = ${modelName}::class;\n\n    public function definition(): array\n    {\n        return [\n${columns.join('\n')}\n        ];\n    }\n}\n`;
            fs.writeFileSync(path.join(factoriesPath, `${className}.php`), content);
        }
        return { success: true, message: 'Factories generated successfully.' };
    } catch (error) { return { success: false, message: error.message }; }
}

async function generateLaravelDatabaseSeeder(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;
        const seedersPath = path.join(basePath, 'database', 'seeders');
        if (!fs.existsSync(seedersPath)) fs.mkdirSync(seedersPath, { recursive: true });

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
            const modelName = getModelClassName(tableName, tables); // UPDATE: Guna Module Name
            importStatements.push(`use App\\Models\\${modelName};`);
            
            const tableData = tables[tableName];
            // Skip jika tiada factory (patut ada jika ikut logic atas)
            const overrides = [];
            const myRelationships = relationships.filter(r => r.child_table_name === tableName);
            myRelationships.forEach(rel => {
                const parentModel = getModelClassName(rel.parent_table_name, tables); // UPDATE
                const fkField = rel.fk_child_field;
                if (rel.parent_table_name === 'users') overrides.push(`            '${fkField}' => 1`);
                else overrides.push(`            '${fkField}' => ${parentModel}::inRandomOrder()->first()?->id ?? null`);
            });
            // PEMBAIKAN: Tukar \\n kepada \n
            runContent.push(`        ${modelName}::factory(20)->create([\n${overrides.join(',\n')}\n        ]);`);
        });

        if (projectSettings.module_authorization === 1) {
            // PEMBAIKAN: Tukar \\n kepada \n
            runContent.push(`\n        // Filament Shield Security`);
            runContent.push(`        $this->call(ShieldSeeder::class);`);
        }
        // PEMBAIKAN: Tukar join('\\n') kepada join('\n')
        const content = `<?php\nnamespace Database\\Seeders;\nuse Illuminate\\Database\\Seeder;\n${importStatements.join('\n')}\n\nclass DatabaseSeeder extends Seeder {\n    public function run(): void {\n${runContent.join('\n')}\n    }\n}`;
        fs.writeFileSync(path.join(seedersPath, 'DatabaseSeeder.php'), content);
        return { success: true, message: 'DatabaseSeeder generated successfully.' };
    } catch (error) { return { success: false, message: error.message }; }
}

// Export functions untuk digunakan di main.js
module.exports = {
    generateFilamentModels,
    generateFilamentUserModel,
    generateLaravelMigrations,
    generateLaravelFactories,
    generateLaravelDatabaseSeeder
};