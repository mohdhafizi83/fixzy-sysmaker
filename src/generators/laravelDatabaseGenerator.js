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
    toPascalCase // Ditambah
} = require('../utils');
const { renderTemplate } = require('../render/engine');

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
 * Generate Laravel Filament Model files from the database schema.
 */
async function generateFilamentModels(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;

        const modelsPath = path.join(basePath, 'app', 'Models');
        fs.mkdirSync(modelsPath, { recursive: true });

        for (const tableName in tables) {
            if (tableName === 'users') continue;

            const tableData = tables[tableName];

            // Logik Traits (SoftDelete, Factory, Audit)
            const fakeData = projectSettings.module_fake_data === 1;
            const softDelete = projectSettings.data_delete_type === 'soft';
            const audit = projectSettings.module_log_audit === 1;

            // --- 1. Tentukan Nama Kelas (Guna Module Name) ---
            const className = getModelClassName(tableName, tables);

            // Setup Fields
            const primaryKeyField = Object.values(tableData.fields).find(f => f.primary_key === 1);

            const excludedFields = ['created_at', 'updated_at', 'deleted_at', primaryKeyField?.field_name];
            const fillableFields = Object.values(tableData.fields).filter(field => !excludedFields.includes(field.field_name) && field.read_only !== 1).map(field => `\n        '${field.field_name}'`).join(',');
            
// ==========================================
            // LOGIK CASTS (DIKEMASKINI UNTUK LARAVEL 11 & ARRAY UI)
            // ==========================================
            const castableFields = Object.values(tableData.fields).filter(field => 
                field.data_type === 'JSON' || 
                (field.data_type === 'BOOLEAN' && field.display_type === 'check_box') ||
                // Add a check for UI components that produce an Array
                ['repeater', 'repeater_simple'].includes(field.display_type)
            );
            
            let modelCasts = '';
            if (castableFields.length > 0) {
                const castLines = castableFields.map(field => {
                    let castType = '';
                    
                    if (field.data_type === 'JSON' || ['repeater', 'repeater_simple'].includes(field.display_type)) {
                        castType = 'array';
                    } else if (field.data_type === 'BOOLEAN' && field.display_type === 'check_box') {
                        castType = 'boolean';
                    }
                    
                    return `\n            '${field.field_name}' => '${castType}',`;
                }).join('');
                
                // Menggunakan standard fungsi Laravel 11: protected function casts(): array
                modelCasts = `\n    protected function casts(): array\n    {\n        return [${castLines}\n        ];\n    }\n`;
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
                    // Use Module Name for the function name (e.g. studentInfos)
                    functionName = getRelationFunctionName(rel.child_table_name, tables, true); 
                    // For One-to-One, use Singular
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

            // Apply Tenant FK (for one_to_many)
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

            if (hasCreatedBy || hasUpdatedBy || hasDeletedBy) {
                let bootMethodContent = `\n    protected static function boot()\n    {\n        parent::boot();\n`;
                
                if (hasCreatedBy || hasUpdatedBy) {
                    bootMethodContent += `\n        static::creating(function ($model) {`;
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
                helperMethods.push(bootMethodContent); // Push into the helperMethods array
            }
            // --- TAMAT LOGIK USERSTAMPS ---

            // Render model template dengan context penuh
            const modelContent = renderTemplate('app/Models/Model.php.njk', {
                import_factory: fakeData ? 'use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;' : '',
                trait_factory: fakeData ? 'use HasFactory;' : '',
                import_softdelete: softDelete ? 'use Illuminate\\Database\\Eloquent\\SoftDeletes;' : '',
                trait_softdelete: softDelete ? 'use SoftDeletes;' : '',
                import_tenant_trait: tenantFkField ? 'use App\\Models\\Concerns\\BelongsToTenant;' : '',
                tenant_property: tenantFkField ? `protected $tenantForeignKey = '${tenantFkField}';` : '',
                trait_tenant: tenantFkField ? 'use BelongsToTenant;' : '',
                import_audit: audit ? 'use App\\Models\\Concerns\\HasAudits;' : '',
                class_implements_audit: '',
                trait_audit: audit ? 'use HasAudits;' : '',
                class_name: className,
                table_name: tableName,
                primary_key: primaryKeyField ? primaryKeyField.field_name : 'id',
                array_editable_byuser_fields: fillableFields ? `${fillableFields}\n    ` : '',
                model_casts: modelCasts,
                relationship_functions: relationshipFunctions.join(''),
                combine_fields_value: accessorFunctions.join('\n'),
                helper_methods: helperMethods.join('\n'),
            });

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
            console.warn("Schema for table 'users' not found. Skipping User.php generation.");
            return { success: true, message: 'User model skipped.' };
        }

        const softDelete = projectSettings.data_delete_type === 'soft';
        const audit = projectSettings.module_log_audit === 1;
        const authorization = projectSettings.module_authorization === 1;
        const tenantMtm = projectSettings.tenancy_type === 'many_to_many' && projectSettings.tenant_table;

        // --- KEKAL 100% LOGIK ASAL ANDA (kini sebagai context values) ---
        const userContext = {
            import_softdelete: softDelete ? 'use Illuminate\\Database\\Eloquent\\SoftDeletes;' : '',
            trait_softdelete: softDelete ? ', SoftDeletes' : '',
            import_audit: audit ? 'use App\\Models\\Concerns\\HasAudits;' : '',
            class_implements_audit: '',
            trait_audit: audit ? ', HasAudits' : '',
            import_shield: authorization ? 'use Spatie\\Permission\\Traits\\HasRoles;' : '',
            trait_shield: authorization ? ', HasRoles' : '',
            import_tenant: tenantMtm ? `use Filament\\Models\\Contracts\\HasTenants;\nuse Illuminate\\Support\\Collection;\nuse Illuminate\\Database\\Eloquent\\Model;\nuse Filament\\Panel;\nuse Illuminate\\Database\\Eloquent\\Relations\\BelongsToMany;` : '',
            // Native audit uses a trait (no interface), so this is always the
            // first `implements` clause when present.
            class_implements_tenant: tenantMtm ? 'implements HasTenants' : '',
            tenant_methods: '',
            relationship_functions: '',
        };

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

        userContext.relationship_functions = relationshipFunctions.join('').replace(/^\n/, '');
        const userModelContent = renderTemplate('app/Models/User.php.njk', userContext);

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
            // Add created_by, updated_by, deleted_by to the ignored list (handled manually below)
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

            // Keep it nullable() so Seeders / system processes (without auth) don't crash
            if (hasCreatedBy) content += `            $table->unsignedBigInteger('created_by')->nullable();\n`;
            if (hasUpdatedBy) content += `            $table->unsignedBigInteger('updated_by')->nullable();\n`;
            
            // Always generate deleted_by (if present in the table) regardless of delete type
            if (hasDeletedBy) content += `            $table->unsignedBigInteger('deleted_by')->nullable();\n`;
            // --- TAMAT LOGIK MIGRASI USERSTAMPS ---

            content += `            $table->timestamps();\n`;
            
            // ▼▼▼ FIX 2: Use global projectSettings for Soft Deletes ▼▼▼
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
                
                // Find the Primary Key of the Tenant Table (usually 'id')
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
            // many-to-many relationships are backed by the pivot table, not a
            // direct FK column on the child table — skip them here or the FK
            // references a column that was never created (SQL error on migrate).
            const childRels = relationships.filter(r => r.child_table_name === tableName && r.relationship_type !== 'many-to-many');
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

/**
 * Generate the dedicated Migration file for the 'users' table.
 * Ia menggabungkan lajur asas Laravel dengan lajur tersuai FiziSysMaker.
 */
async function generateLaravelUserMigration(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;
        const migrationsPath = path.join(basePath, 'database', 'migrations');
        if (!fs.existsSync(migrationsPath)) fs.mkdirSync(migrationsPath, { recursive: true });

        // (template kini Nunjucks; content dibina selepas kitaran lajur)
        let customFieldsCode = '';
        const userData = tables['users'];

        if (userData && userData.fields) {
            // Columns already present in Laravel's base template. Ignore them.
            const standardFields = ['id', 'name', 'email', 'email_verified_at', 'password', 'remember_token', 'created_at', 'updated_at', 'deleted_at'];
            
            const fieldsArr = Object.values(userData.fields).sort((a, b) => (a.field_order || 999) - (b.field_order || 999));

            fieldsArr.forEach(field => {
                // Langkau jika ia adalah lajur asas
                if (standardFields.includes(field.field_name)) return;

                const isForeignKey = relationships.some(r => r.child_table_name === 'users' && r.fk_child_field === field.field_name);
                let line = '';
                const upperType = field.data_type ? field.data_type.toUpperCase() : 'VARCHAR';

                // Logik janaan padanan jenis data (sama seperti migrasi biasa)
                if (isForeignKey && ['INT', 'INTEGER', 'BIGINT'].includes(upperType)) {
                    line = `            $table->foreignId('${field.field_name}')`;
                } else if (['VARCHAR', 'STRING', 'CHAR'].includes(upperType)) {
                    const method = upperType === 'CHAR' ? 'char' : 'string';
                    const lengthParam = (field.length && parseInt(field.length) > 0) ? `, ${field.length}` : '';
                    line = `            $table->${method}('${field.field_name}'${lengthParam})`;
                } else {
                    line = `            ${getFieldDefinitionForMigration(field)}`;
                }

                // Logik Nullable
                if (field.not_null !== undefined && field.not_null !== null) { 
                    if (Number(field.not_null) === 0) line += `->nullable()`; 
                } else { 
                    if (field.is_nullable === 1) line += `->nullable()`; 
                }
                
                // Logik Default Value
                if (field.default_value) { 
                    if (field.default_value.toUpperCase() === 'CURRENT_TIMESTAMP') line += `->useCurrent()`; 
                    else line += `->default('${field.default_value}')`; 
                }
                
                // Logik Unique
                if (field.is_unique === 1 || field.unique === 1) line += `->unique()`;

                customFieldsCode += `${line};\n`;
            });
        }

        // Render template migrasi users dengan context
        const content = renderTemplate('database/migrations/create_users_table.php.njk', {
            custom_fields: customFieldsCode || '',
            soft_deletes: (projectSettings && projectSettings.data_delete_type === 'soft')
                ? '            $table->softDeletes();' : '',
        });

        // Tulis fail dengan nama rasmi migrasi Laravel supaya ia kekal berjalan paling awal
        const fileName = '0001_01_01_000000_create_users_table.php';
        fs.writeFileSync(path.join(migrationsPath, fileName), content);

        return { success: true, message: 'User Migration generated successfully.' };
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
            
            // UPDATE: Use Module Name for the Factory Class Name
            const modelName = getModelClassName(tableName, tables);
            const className = `${modelName}Factory`;
            
const columns = [];
            const fieldsArr = Object.values(tableData.fields);
            
fieldsArr.forEach(field => {
                if (field.primary_key === 1) return;
                if (['created_at', 'updated_at', 'deleted_at'].includes(field.field_name)) return;
                
                // ▼▼▼ MULA: LOGIK RECORD OWNER (SUPER ADMIN ID = 1) ▼▼▼
                // Jika table ini di set sebagai 'current_user' dan field ini adalah created_by/updated_by
                if (tableData.record_owner === 'current_user' && ['created_by', 'updated_by', 'user_id'].includes(field.field_name)) {
                    // Kita paksa ia menjadi 1 (Super Admin) supaya data ini muncul di dashboard admin
                    columns.push(`            '${field.field_name}' => 1,`);
                    return; // Skip the logic below and continue to the next field
                }
                // ▲▲▲ TAMAT LOGIK RECORD OWNER ▲▲▲

// ▼▼▼ MULA: LOGIK FOREIGN KEY UNTUK FACTORY (Sokongan Senario 4) ▼▼▼
                const relation = relationships.find(r => r.child_table_name === tableName && r.fk_child_field === field.field_name);
                
                if (relation) {
                    // Get the Model name of the Parent table
                    const parentModelName = getModelClassName(relation.parent_table_name, tables);
                    
                    // Teach the Factory to pull a random ID from the Parent table
                    columns.push(`            '${field.field_name}' => \\App\\Models\\${parentModelName}::inRandomOrder()->value('id'),`);
                    return; // Done for this Foreign Key field; skip to the next field
                }
                // ▲▲▲ TAMAT LOGIK FOREIGN KEY ▲▲▲

                // ▼▼▼ MULA: LOGIK OPTIONS LIST (NILAI TETAP / FIXED VALUES) ▼▼▼
                if (field.display_type === 'options_list' && field.options_list_values) {
                    // 1. Pisahkan teks berdasarkan koma (,), baris baharu (\n), titik bertindih (;), atau pipe (|)
                    const optionsArray = field.options_list_values
                        .split(/[\n,;|]+/) // <--- PERUBAHAN DI SINI (Tambah ; dan |)
                        .map(opt => opt.trim())       // Bersihkan ruang kosong
                        .filter(opt => opt !== '');   // Drop empty values
                        
                    if (optionsArray.length > 0) {
                        // 2. Format into a valid PHP array literal
                        const phpArrayString = optionsArray.map(opt => `'${opt.replace(/'/g, "\\'")}'`).join(', ');
                        
                        // 3. Bina sintaks faker randomElement
                        const optionsFakerLogic = `$this->faker->randomElement([${phpArrayString}])`;
                        
                        columns.push(`            '${field.field_name}' => ${optionsFakerLogic},`);
                        return; // Done for this field; skip to the next field!
                    }
                }
                // ▲▲▲ TAMAT LOGIK OPTIONS LIST ▲▲▲
                
                // Get the original faker string (e.g. $this->faker->word()) for other fields
                let fakerLogic = getFakerFormatter(field);
                
// ▼▼▼ MULA: LOGIK ARRAY / JSON YANG KETAT ▼▼▼
                const isArrayType = field.data_type === 'JSON' || 
                    ['repeater', 'repeater_simple', 'multiple_select', 'checkbox_list', 'tags_input'].includes(field.display_type);
                
                if (isArrayType) {
                    // SMART HELPER: Replaces getFakerFormatter which failed to read JSON
                    const getRealFaker = (fieldName, formatAs) => {
                        const nameLower = fieldName.toLowerCase();
                        if (formatAs === 'email' || nameLower.includes('email')) {
                            return `$this->faker->unique()->safeEmail()`; // Must be unique to avoid a DB crash!
                        }
                        if (formatAs === 'tel' || nameLower.includes('tel') || nameLower.includes('phone')) {
                            return `$this->faker->phoneNumber()`;
                        }
                        if (formatAs === 'url' || nameLower.includes('url')) {
                            return `$this->faker->url()`;
                        }
                        if (nameLower.includes('name') || nameLower.includes('nama')) {
                            return `$this->faker->name()`;
                        }
                        return `$this->faker->word()`;
                    };

                    if (field.display_type === 'repeater') {
                        // Untuk Repeater Kompleks: Bina 2 objek berasingan
                        let object1Keys = [];
                        let object2Keys = [];

                        for (let i = 1; i <= 3; i++) {
                            if (field[`repeater_${i}_display_as`]) {
                                const format = field[`repeater_${i}_format_as`];
                                const fakeItem1 = getRealFaker(field.field_name, format);
                                const fakeItem2 = getRealFaker(field.field_name, format);

                                object1Keys.push(`'${field.field_name}_${i}' => ${fakeItem1}`);
                                object2Keys.push(`'${field.field_name}_${i}' => ${fakeItem2}`);
                            }
                        }
                        const assocArray1 = `[${object1Keys.join(', ')}]`;
                        const assocArray2 = `[${object2Keys.join(', ')}]`;
                        
                        fakerLogic = `[${assocArray1}, ${assocArray2}]`;
                        
                    } else {
                        // For Simple Repeater / Tags / etc: build 3 distinct random strings
                        const format = field.repeater_simple_format_as;
                        const fake1 = getRealFaker(field.field_name, format);
                        const fake2 = getRealFaker(field.field_name, format);
                        const fake3 = getRealFaker(field.field_name, format);
                        
                        fakerLogic = `[${fake1}, ${fake2}, ${fake3}]`;
                    }
                }
                // ▲▲▲ TAMAT LOGIK ARRAY / JSON ▲▲▲

                columns.push(`            '${field.field_name}' => ${fakerLogic},`);
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
        
        runContent.push(`        // 1. Cipta Pengguna Ujian (Super Admin)`);
        runContent.push(`        $user = User::firstOrCreate(`);
        runContent.push(`            ['email' => 'admin@admin.com'],`);
        runContent.push(`            ['name' => 'Super Admin', 'password' => bcrypt('password')]`);
        runContent.push(`        );`);

        // If the Authorization module (Spatie/Filament Shield) is enabled, assign the super_admin role
        if (projectSettings.module_authorization === 1) {
            runContent.push(`\n        // Tugaskan Peranan (Role) Super Admin`);
            runContent.push(`        $role = \\Spatie\\Permission\\Models\\Role::firstOrCreate([`);
            runContent.push(`            'name' => 'super_admin',`);
            runContent.push(`            'guard_name' => 'web'`);
            runContent.push(`        ]);`);
            runContent.push(`        $user->assignRole($role);\n`);
        }

        sortedTables.forEach(tableName => {
            const modelName = getModelClassName(tableName, tables);
            
            // Elakkan import duplikat
            if (!importStatements.includes(`use App\\Models\\${modelName};`)) {
                importStatements.push(`use App\\Models\\${modelName};`);
            }
            
            const overrides = [];
            const myRelationships = relationships.filter(r => r.child_table_name === tableName);
            myRelationships.forEach(rel => {
                const parentModel = getModelClassName(rel.parent_table_name, tables);
                const fkField = rel.fk_child_field;
                if (rel.parent_table_name === 'users') {
                    overrides.push(`                    '${fkField}' => 1`);
                } else {
                    overrides.push(`                    '${fkField}' => ${parentModel}::inRandomOrder()->first()?->id ?? null`);
                }
            });

            // MULA PEMBAIKAN KESTABILAN (TRY-CATCH LOOP)
            runContent.push(`\n        // Seed ${modelName} (Kalis Ralat Unique Constraint)`);
            runContent.push(`        for ($i = 0; $i < 20; $i++) {`);
            runContent.push(`            try {`);
            
            if (overrides.length > 0) {
                runContent.push(`                ${modelName}::factory()->create([\n${overrides.join(',\n')}\n                ]);`);
            } else {
                runContent.push(`                ${modelName}::factory()->create();`);
            }
            
            runContent.push(`            } catch (\\Exception $e) {`);
            runContent.push(`                // Abaikan jika data duplikat atau langgar Unique Constraint`);
            runContent.push(`            }`);
            runContent.push(`        }`);
            // TAMAT PEMBAIKAN KESTABILAN
        });

        if (projectSettings.module_authorization === 1) {
            runContent.push(`\n        // Filament Shield Security`);
            runContent.push(`        $this->call(ShieldSeeder::class);`);
        }

        const content = `<?php\nnamespace Database\\Seeders;\nuse Illuminate\\Database\\Seeder;\n${importStatements.join('\n')}\n\nclass DatabaseSeeder extends Seeder {\n    public function run(): void {\n${runContent.join('\n')}\n    }\n}`;
        fs.writeFileSync(path.join(seedersPath, 'DatabaseSeeder.php'), content);
        
        return { success: true, message: 'DatabaseSeeder generated successfully.' };
    } catch (error) { 
        return { success: false, message: error.message }; 
    }
}

// Export functions for use in main.js
/**
 * Generate the native audit-trail files (Phase 4).
 *
 * Replaces the 3rd-party owen-it/laravel-auditing + tapp/filament-auditing
 * pair with plain app code: audits migration, Audit model, AuditObserver,
 * HasAudits trait, and a read-only AuditsRelationManager.
 * Only emitted when project.module_log_audit === 1.
 */
async function generateNativeAuditFiles(fullSchema, basePath) {
    try {
        const { project: projectSettings } = fullSchema;
        if (!projectSettings || projectSettings.module_log_audit !== 1) {
            return { success: true, message: 'Auditing off — native audit files skipped.' };
        }

        const writes = [
            ['app/Models/Concerns/HasAudits.php', 'app/Models/Concerns/HasAudits.php.njk'],
            ['app/Models/Audit.php', 'app/Models/Audit.php.njk'],
            ['app/Observers/AuditObserver.php', 'app/Observers/AuditObserver.php.njk'],
            ['app/Filament/RelationManagers/AuditsRelationManager.php', 'app/Filament/RelationManagers/AuditsRelationManager.php.njk'],
        ];
        for (const [outRel, tpl] of writes) {
            const outPath = path.join(basePath, outRel);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, renderTemplate(tpl, {}));
        }

        // audits table migration (timestamped like other migrations)
        const migrationsPath = path.join(basePath, 'database', 'migrations');
        fs.mkdirSync(migrationsPath, { recursive: true });
        const timestamp = getFormattedTimestamp(new Date(), 990);
        const migPath = path.join(migrationsPath, `${timestamp}_create_audits_table.php`);
        fs.writeFileSync(migPath, renderTemplate('database/migrations/create_audits_table.php.njk', {}));

        return { success: true, message: 'Native audit files generated.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    generateFilamentModels,
    generateFilamentUserModel,
    generateLaravelUserMigration,
    generateLaravelMigrations,
    generateLaravelFactories,
    generateLaravelDatabaseSeeder,
    generateNativeAuditFiles
};
