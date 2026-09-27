// laravelApiGenerator.js — emits the REST API module when any table
// has api_enabled=1:
//   - app/Api/ApiRegistry.php (per-table allowlist + rules + roles)
//   - app/Http/Controllers/Api/ApiController.php (generic CRUD)
//   - app/Providers/ApiServiceProvider.php (routes /api/v1/*)
//   - app/Filament/Pages/ApiTokens.php + blade (token management)
//   - personal_access_tokens migration (Sanctum schema)
// Projects with no API-enabled table emit NOTHING.

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { toSingularPascalCase } = require('../utils');
const { getApiProfile, resolveApiFields, isApiEnabled } = require('./apiConfig');

// Map a field's IR to Laravel validation rules (string list).
/** @param {object} field field row from the schema @returns {string[]} Laravel validation rule strings */
function fieldRules(field) {
    const rules = [];
    const dt = String(field.data_type || '').toUpperCase();
    const required = Number(field.required) === 1 || Number(field.not_null) === 1;

    if (/INT|BIGINT|SMALLINT/.test(dt)) rules.push('integer');
    else if (/DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL/.test(dt)) rules.push('numeric');
    else if (/DATE|TIME/.test(dt)) rules.push('date');
    else if (/BOOL|TINYINT\(1\)/.test(dt)) rules.push('boolean');
    else rules.push('string');

    if (/VARCHAR|CHAR|TEXT|STRING/.test(dt)) {
        const max = Number(field.max_length) > 0 ? Number(field.max_length) : Number(field.length);
        if (max > 0) rules.push(`max:${max}`);
    }
    if (required) rules.unshift('required');

    return rules;
}

/** Serialize a JS list as a JSON array literal (valid PHP 7.4+ array syntax via json). @param {Array} list @returns {string} JSON array string */
function phpArrayJson(list) {
    return JSON.stringify(list);
}

// PHP associative array literal from a JS object ({"a":1} → ['a'=>1]).
/** @param {object} obj plain object @returns {string} PHP ['k' => v, ...] literal */
function phpAssoc(obj) {
    const parts = Object.entries(obj).map(([k, v]) => {
        const val = Array.isArray(v) ? phpArrayJson(v) : JSON.stringify(v);
        return `'${k}' => ${val}`;
    });
    return '[' + parts.join(', ') + ']';
}

/**
 * Generate the REST API module (registry, controller, middleware, provider,
 * token pages, Sanctum migration) for all API-enabled tables.
 * @param {object} fullSchema assembled project schema
 * @param {string} outputDir generated app root
 * @returns {{success: boolean, files: string[], skipped?: boolean, error?: string, message?: string}}
 */
function generateApiModule(fullSchema, outputDir) {
    try {
        const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
        const enabled = Object.entries(tables).filter(([name]) => name !== 'users' && isApiEnabled(tables[name]));
        if (enabled.length === 0) {
            return { success: true, files: [], skipped: true };
        }

        const written = [];
        /** Write generated content to outputDir/relPath and track it. @param {string} relPath path relative to outputDir @param {string} content file contents @returns {void} */
        const emit = (relPath, content) => {
            const abs = path.join(outputDir, relPath);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, content);
            written.push(relPath);
        };

        const registryTables = {};
        const slugs = [];
        for (const [tableName, tableData] of enabled) {
            const profile = getApiProfile(tableData);
            const fields = resolveApiFields(tableData, profile);
            if (fields.length === 0) continue;

            const slug = tableName.toLowerCase();
            const rules = {};
            const unique = [];
            for (const f of fields) {
                const fieldData = tableData.fields[f];
                if (!fieldData) continue;
                rules[f] = fieldRules(fieldData);
                if (Number(fieldData.unique) === 1) unique.push(f);
            }

            registryTables[slug] = {
                model_class: '\\App\\Models\\' + toSingularPascalCase(tableName),
                table_name: tableName,
                fields_php: phpArrayJson(fields),
                rules_php: phpAssoc(rules),
                unique_php: phpArrayJson(unique),
                read_roles_php: phpArrayJson(profile.readRoles),
                write_roles_php: phpArrayJson(profile.writeRoles),
                rate_limit: profile.rateLimit,
            };
            slugs.push(slug);
        }

        if (slugs.length === 0) {
            return { success: true, files: [], skipped: true };
        }

        emit(path.join('app', 'Api', 'ApiRegistry.php'),
            renderTemplate('app/Api/ApiRegistry.php.njk', { tables: registryTables }));
        emit(path.join('app', 'Http', 'Controllers', 'Api', 'ApiController.php'),
            renderTemplate('app/Http/Controllers/Api/ApiController.php.njk', {}));
        emit(path.join('app', 'Http', 'Middleware', 'ApiJsonRequest.php'),
            renderTemplate('app/Http/Middleware/ApiJsonRequest.php.njk', {}));
        emit(path.join('app', 'Providers', 'ApiServiceProvider.php'),
            renderTemplate('app/Providers/ApiServiceProvider.php.njk', { slugs }));
        emit(path.join('app', 'Filament', 'Pages', 'ApiTokens.php'),
            renderTemplate('app/Filament/Pages/ApiTokens.php.njk', {}));
        emit(path.join('resources', 'views', 'filament', 'pages', 'api-tokens.blade.php'),
            renderTemplate('resources/views/filament/pages/api-tokens.blade.php.njk', {}));

        // Sanctum personal_access_tokens migration (schema copied from
        // laravel/sanctum 4.x; emitted so the generated app is
        // self-contained without `php artisan vendor:publish`).
        emit(path.join('database', 'migrations', '2026_01_01_000001_create_personal_access_tokens_table.php'),
            `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->text('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personal_access_tokens');
    }
};
`);

        // Register provider in bootstrap/providers.php.
        const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
        if (fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            if (!contents.includes('ApiServiceProvider')) {
                contents = contents.replace(
                    /return\s*\[/,
                    'return [\n    App\\Providers\\ApiServiceProvider::class,'
                );
                fs.writeFileSync(providersFile, contents);
            }
        }

        // Manifest: sanctum is a hard dependency of this module.
        const manifestPath = path.join(outputDir, 'fixzy-manifest.json');
        let manifest = { composer: [], php_extensions: [], npm: [], providers: [] };
        if (fs.existsSync(manifestPath)) {
            try {
                const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                manifest = {
                    composer: Array.isArray(existing.composer) ? existing.composer : [],
                    php_extensions: Array.isArray(existing.php_extensions) ? existing.php_extensions : [],
                    npm: Array.isArray(existing.npm) ? existing.npm : [],
                    providers: Array.isArray(existing.providers) ? existing.providers : [],
                };
            } catch (e) {
                // Corrupt manifest: start fresh rather than crash the build.
            }
        }
        if (!manifest.composer.includes('laravel/sanctum')) {
            manifest.composer.push('laravel/sanctum');
        }
        const providerClass = 'App\\Providers\\ApiServiceProvider';
        if (!manifest.providers.includes(providerClass)) {
            manifest.providers.push(providerClass);
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        return { success: true, files: written };
    } catch (error) {
        return { success: false, error: error.message, message: error.message };
    }
}

module.exports = { generateApiModule };
