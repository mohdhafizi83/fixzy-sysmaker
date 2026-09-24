// laravelPublicFormGenerator.js — emits the Public Intake Form module
// when any table enables a public form (tables.public_form_enabled +
// public_form_config JSON). Generated files:
//   - app/Http/Controllers/PublicFormController.php  (compiled registry)
//   - app/Providers/PublicFormServiceProvider.php    (routes /f/{slug})
//   - resources/views/public/form.blade.php          (standalone, no Filament)
//   - resources/views/public/success.blade.php
//   - resources/views/public/lookup.blade.php
//   - migration: add public_reference (unique) to each enabled table
// Security: CSRF + throttle + honeypot + arithmetic captcha +
// server-side validation mirroring the table schema; lookup returns
// status + last-update only (no record exposure).

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { getFormattedTimestamp } = require('../utils');
const { parsePublicFormConfig, collectPublicForms } = require('./publicFormConfig');

// Map an IR field to a Laravel validation rule string.
function validationRulesFor(field) {
    const rules = [];
    const dt = (field.data_type || '').toUpperCase();
    const name = (field.field_name || '').toLowerCase();
    const required = field.required === 1 || field.required === true || field.not_null === 1;
    rules.push(required ? 'required' : 'nullable');
    if (name.includes('email') || dt === 'EMAIL') rules.push('email', 'max:255');
    else if (/^(INT|BIGINT|SMALLINT)$/.test(dt)) rules.push('integer');
    else if (/^(DECIMAL|NUMERIC|FLOAT|DOUBLE)$/.test(dt)) rules.push('numeric');
    else if (/^(DATE|DATETIME|TIMESTAMP|TIME)$/.test(dt)) rules.push('date');
    else if (dt === 'BOOLEAN') rules.push('boolean');
    else {
        const len = field.max_length || field.length || 255;
        rules.push('string', `max:${Math.min(Number(len) || 255, 2000)}`);
    }
    return rules;
}

function generatePublicFormModule(fullSchema, outputDir) {
    try {
        const written = [];
        const forms = collectPublicForms(fullSchema);
        if (forms.length === 0) {
            return { success: true, files: [], skipped: true };
        }
        const tables = (fullSchema.database && fullSchema.database.table) || {};
        const { getModelClassName } = require('./laravelDatabaseGenerator');

        // Compile the registry: slug -> {model, fields:[{name,label,rules}],
        // captcha, lookup, status_default, intro, success, email_field}.
        const registry = {};
        forms.forEach((f) => {
            const tableData = tables[f.table_name];
            if (!tableData) return;
            const fields = [];
            let emailField = null;
            f.allowed_fields.forEach((fname) => {
                const field = (tableData.fields || {})[fname];
                if (!field) return;
                const rules = validationRulesFor(field);
                const isEmail = (fname.toLowerCase().includes('email') || (field.data_type || '').toUpperCase() === 'EMAIL');
                if (isEmail && !emailField) emailField = fname;
                fields.push({
                    name: fname,
                    label: field.caption || fname,
                    rules,
                    type: isEmail ? 'email' : (/^(DATE|DATETIME|TIMESTAMP)$/.test((field.data_type || '').toUpperCase()) ? 'date' : (/^(INT|BIGINT|SMALLINT|DECIMAL|NUMERIC|FLOAT|DOUBLE)$/.test((field.data_type || '').toUpperCase()) ? 'number' : 'text')),
                    required: field.required === 1 || field.required === true || field.not_null === 1,
                });
            });
            if (fields.length === 0) return;
            registry[f.slug] = {
                model: getModelClassName(f.table_name, tables),
                table: f.table_name,
                fields,
                email_field: emailField,
                captcha: f.captcha_required,
                lookup: f.lookup_enabled,
                status_default: f.status_field_default,
                intro: f.intro_text,
                success: f.success_text,
            };
        });

        const emit = (relPath, template, context) => {
            const abs = path.join(outputDir, relPath);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            if (fs.existsSync(abs)) return;
            fs.writeFileSync(abs, renderTemplate(template, context || {}));
            written.push(relPath);
        };

        emit(path.join('app', 'Http', 'Controllers', 'PublicFormController.php'),
            'app/Http/Controllers/PublicFormController.php.njk',
            { registry_php: exportPhpArray(registry) });
        emit(path.join('app', 'Providers', 'PublicFormServiceProvider.php'),
            'app/Providers/PublicFormServiceProvider.php.njk');
        emit(path.join('resources', 'views', 'public', 'form.blade.php'),
            'resources/views/public/form.blade.php.njk');
        emit(path.join('resources', 'views', 'public', 'success.blade.php'),
            'resources/views/public/success.blade.php.njk');
        emit(path.join('resources', 'views', 'public', 'lookup.blade.php'),
            'resources/views/public/lookup.blade.php.njk');

        // Migration: add public_reference to each enabled table.
        const ts = getFormattedTimestamp(new Date(), 2);
        const migName = `${ts}_add_public_reference_to_public_forms.php`;
        emit(path.join('database', 'migrations', migName),
            'database/migrations/add_public_reference.php.njk',
            { tables: Object.values(registry).map((r) => r.table) });

        // Register provider (bootstrap/providers.php + manifest).
        const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
        if (fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            if (!contents.includes('PublicFormServiceProvider')) {
                contents = contents.replace(/return\s*\[/, 'return [\n    App\\Providers\\PublicFormServiceProvider::class,');
                fs.writeFileSync(providersFile, contents);
            }
        }
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
            } catch (e) { /* fresh */ }
        }
        if (!manifest.providers.includes('App\\Providers\\PublicFormServiceProvider')) {
            manifest.providers.push('App\\Providers\\PublicFormServiceProvider');
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        written.push('fixzy-manifest.json');

        return { success: true, files: written };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Render the compiled registry as a PHP array literal (pretty, stable).
function exportPhpArray(obj) {
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const lines = [];
    lines.push('[');
    Object.entries(obj).forEach(([slug, r]) => {
        lines.push(`        '${esc(slug)}' => [`);
        lines.push(`            'model' => \\App\\Models\\${r.model}::class,`);
        lines.push(`            'table' => '${esc(r.table)}',`);
        lines.push(`            'email_field' => ${r.email_field ? `'${esc(r.email_field)}'` : 'null'},`);
        lines.push(`            'captcha' => ${r.captcha ? 'true' : 'false'},`);
        lines.push(`            'lookup' => ${r.lookup ? 'true' : 'false'},`);
        lines.push(`            'status_default' => '${esc(r.status_default)}',`);
        lines.push(`            'intro' => '${esc(r.intro)}',`);
        lines.push(`            'success' => '${esc(r.success)}',`);
        lines.push(`            'fields' => [`);
        r.fields.forEach((f) => {
            lines.push(`                ['name' => '${esc(f.name)}', 'label' => '${esc(f.label)}', 'type' => '${esc(f.type)}', 'required' => ${f.required ? 'true' : 'false'}, 'rules' => ['${f.rules.join("', '")}']],`);
        });
        lines.push(`            ],`);
        lines.push(`        ],`);
    });
    lines.push('    ]');
    return lines.join('\n');
}

module.exports = { generatePublicFormModule };
