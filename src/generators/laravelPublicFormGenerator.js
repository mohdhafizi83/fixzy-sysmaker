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
/** @param {object} field field row @returns {string[]} Laravel validation rules (required/nullable first) */
function validationRulesFor(field) {
    const rules = [];
    const dt = (field.data_type || '').toUpperCase();
    const name = (field.field_name || '').toLowerCase();
    const required = field.required === 1 || field.required === true || field.not_null === 1;
    rules.push(required ? 'required' : 'nullable');
    if (field.media_type === 'image') {
        const kb = Math.max(1, parseInt(field.max_file_size, 10) || 2048);
        rules.push('image', `max:${kb}`);
    } else if (field.media_type === 'upload') {
        const kb = Math.max(1, parseInt(field.file_max_size, 10) || 2048);
        rules.push('file', `max:${kb}`);
        const exts = String(field.file_types || '').split(',').map((t) => t.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
        if (exts.length) rules.push(`mimes:${exts.join(',')}`);
    } else if (field.media_type === 'attachments') {
        const maxFiles = Math.min(50, Math.max(1, parseInt(field.attach_max_files, 10) || 10));
        rules.push('array', `max:${maxFiles}`);
    } else if (field.media_type === 'gmap' || field.media_type === 'youtube') {
        rules.push('string', 'max:2000');
    } else if (field.lookup_parent_table) {
        // FK fields: must reference an existing parent row.
        rules.push('integer', `exists:${field.lookup_parent_table},id`);
    } else if (field.display_type === 'options_list') {
        const vals = parseOptionsList(field).map((o) => o.value);
        if (field.options_display === 'multi') {
            rules.push('array');
        } else if (vals.length) {
            rules.push(`in:${vals.join(',')}`);
        } else {
            rules.push('string', 'max:255');
        }
    } else if (field.display_type === 'repeater_simple') {
        rules.push('array');
    } else if (name.includes('email') || dt === 'EMAIL') rules.push('email', 'max:255');
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

/** Per-item validation rules for array-shaped controls (multi-select, repeater). @param {object} field @returns {string[]} */
function itemRulesFor(field) {
    if (field.media_type === 'attachments') {
        const kb = Math.max(1, parseInt(field.attach_max_size, 10) || 10240);
        const exts = String(field.attach_types || '').split(',').map((t) => t.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
        const r = ['file', `max:${kb}`];
        if (exts.length) r.push(`mimes:${exts.join(',')}`);
        return r;
    }
    if (field.display_type === 'options_list' && field.options_display === 'multi') {
        const vals = parseOptionsList(field).map((o) => o.value);
        return vals.length ? [`in:${vals.join(',')}`] : ['string'];
    }
    if (field.display_type === 'repeater_simple') {
        const fmt = (field.repeater_simple_format_as || '').toLowerCase();
        if (fmt === 'email') return ['email'];
        if (fmt === 'url') return ['url'];
        return ['string', 'max:255'];
    }
    return [];
}

/** Parse `a;;b;;c` option list values into {value,label} pairs. @param {object} field @returns {Array<{value:string,label:string}>} */
function parseOptionsList(field) {
    return String(field.options_list_values || '').split(';;').map((s) => s.trim()).filter(Boolean)
        .map((v) => ({ value: v, label: v }));
}

/** Resolve the public-form control descriptor for a field. @param {object} field @param {object} tables @returns {{control:string, options?:Array, lookup?:{table:string,caption:string}}} */
function computeControl(field, tables) {
    const dt = (field.data_type || '').toUpperCase();
    const fmt = (field.format_as || '').toLowerCase();
    const disp = field.display_type;
    const od = field.options_display;
    if (field.lookup_parent_table) {
        const caption = field.lookup_caption_1 || 'id';
        return { control: od === 'radios' || field.lookup_display_as === 'radios' ? 'radio_lookup' : 'select_lookup', lookup: { table: field.lookup_parent_table, caption } };
    }
    if (disp === 'text_area' || disp === 'rich_html') return { control: 'textarea' };
    if (disp === 'check_box') return { control: 'checkbox' };
    if (field.media_type === 'image') return { control: 'image', storage: field.image_storage_provider || 'public', maxKb: Math.max(1, parseInt(field.max_file_size, 10) || 2048) };
    if (field.media_type === 'upload') return { control: 'file', storage: field.file_storage_provider || 'public', maxKb: Math.max(1, parseInt(field.file_max_size, 10) || 2048), types: (field.file_types || '').split(',').map((t) => t.trim().toLowerCase().replace(/^\./, '')).filter(Boolean) };
    if (field.media_type === 'attachments') return { control: 'files', storage: 'local', maxKb: Math.max(1, parseInt(field.attach_max_size, 10) || 10240), maxFiles: Math.min(50, Math.max(1, parseInt(field.attach_max_files, 10) || 10)), types: (field.attach_types || '').split(',').map((t) => t.trim().toLowerCase().replace(/^\./, '')).filter(Boolean) };
    if (field.media_type === 'gmap' || field.media_type === 'youtube') return { control: 'embed' };
    if (disp === 'options_list') {
        if (od === 'multi') return { control: 'multiselect', options: parseOptionsList(field) };
        if (od === 'radios') return { control: 'radios', options: parseOptionsList(field) };
        return { control: 'select', options: parseOptionsList(field) };
    }
    if (disp === 'repeater_simple') return { control: 'repeater' };
    if (fmt === 'email') return { control: 'email' };
    if (fmt === 'url') return { control: 'url' };
    if (fmt === 'tel') return { control: 'tel' };
    if (fmt === 'password') return { control: 'password' };
    if (dt === 'DATE') return { control: 'date' };
    if (dt === 'DATETIME' || dt === 'TIMESTAMP') return { control: 'datetime' };
    if (/^(INT|BIGINT|SMALLINT)$/.test(dt)) return { control: 'number' };
    if (/^(DECIMAL|NUMERIC|FLOAT|DOUBLE)$/.test(dt)) return { control: 'decimal' };
    return { control: 'text' };
}

/**
 * Generate the Public Intake Form module (controller, provider, views,
 * public_reference migration) when any table enables a public form.
 * @param {object} fullSchema assembled project schema
 * @param {string} outputDir generated app root
 * @returns {{success: boolean, files: string[], skipped?: boolean, error?: string}}
 */
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
                const control = computeControl(field, tables);
                fields.push({
                    name: fname,
                    label: field.caption || fname,
                    rules,
                    itemRules: itemRulesFor(field),
                    control: control.control,
                    options: control.options || null,
                    lookup: control.lookup || null,
                    storage: control.storage || null,
                    maxKb: control.maxKb || null,
                    maxFiles: control.maxFiles || null,
                    types: control.types || null,
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

        /** Render a template to outputDir/relPath once (skips existing files). @param {string} relPath @param {string} template njk path @param {object} [context] @returns {void} */
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
        // Timestamp must sort AFTER every create_* migration of this run:
        // with equal hhmmss, "add_public_reference..." sorts before
        // "create_<table>..." alphabetically, so the hasTable guard would
        // silently skip adding the column (live browser test, 2026-10-01:
        // every public insert died with "no column named public_reference").
        const ts = getFormattedTimestamp(new Date(Date.now() + 60_000), 1);
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
/** @param {object} obj compiled slug -> form registry @returns {string} PHP array literal */
function exportPhpArray(obj) {
    /** Escape for single-quoted PHP literals. @param {*} s @returns {string} */
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
            const extra = [];
            if (f.storage) extra.push(`'storage' => '${esc(f.storage)}'`);
            if (f.maxKb) extra.push(`'max_kb' => ${f.maxKb}`);
            if (f.maxFiles) extra.push(`'max_files' => ${f.maxFiles}`);
            if (f.types) extra.push(`'types' => ['${f.types.join("', '")}']`);
            lines.push(`                ['name' => '${esc(f.name)}', 'label' => '${esc(f.label)}', 'type' => '${esc(f.type)}', 'control' => '${esc(f.control)}', 'required' => ${f.required ? 'true' : 'false'}, 'rules' => ['${f.rules.join("', '")}'], 'item_rules' => [${f.itemRules.length ? `'${f.itemRules.join("', '")}'` : ''}], 'options' => ${f.options ? `[${f.options.map((o) => `['value' => '${esc(o.value)}', 'label' => '${esc(o.label)}']`).join(', ')}]` : 'null'}, 'lookup' => ${f.lookup ? `['table' => '${esc(f.lookup.table)}', 'caption' => '${esc(f.lookup.caption)}']` : 'null'}${extra.length ? ", " + extra.join(', ') : ''}],`);
        });
        lines.push(`            ],`);
        lines.push(`        ],`);
    });
    lines.push('    ]');
    return lines.join('\n');
}

module.exports = { generatePublicFormModule, validationRulesFor };
