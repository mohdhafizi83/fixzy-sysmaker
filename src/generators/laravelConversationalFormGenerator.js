// laravelConversationalFormGenerator.js — emits the Conversational Form
// module (E6) when any table sets form_layout_config.style =
// "conversational". Generated files:
//   - app/Livewire/ConversationalForm.php        (chat engine, compiled registry)
//   - resources/views/livewire/conversational-form.blade.php (chat UI)
//   - app/Providers/ConversationalFormServiceProvider.php (routes /chat/{slug})
// Security: CSRF + throttle on POST, server-side validation mirroring the
// table schema, visible_if/required_if honoured server-side (client is
// UI-only), no mass assignment (explicit fill array).

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { collectConversationalForms } = require('./conversationalConfig');
const { parseFieldFormSettings } = require('./formLayoutConfig');
const { validationRulesFor } = require('./laravelPublicFormGenerator');

/**
 * Build the compiled conversational-form registry keyed by slug:
 * model, table, chat copy, and per-field chat descriptors.
 * @param {object} fullSchema assembled project schema
 * @returns {object} registry map (slug -> form definition)
 */
function buildRegistry(fullSchema) {
    const tables = (fullSchema.database && fullSchema.database.table) || {};
    const { getModelClassName } = require('./laravelDatabaseGenerator');
    const registry = {};
    collectConversationalForms(fullSchema).forEach((f) => {
        const tableData = tables[f.table_name];
        if (!tableData) return;
        const fields = [];
        // For custom-module chat entries, apply the module's per-field
        // settings_override on top of the base field (same semantics as the
        // form/table custom-module generators).
        let moduleFieldOverrides = {};
        if (f.module_id && Array.isArray(tableData.custom_modules)) {
            const mod = tableData.custom_modules.find((m) => m.module_id === f.module_id);
            if (mod && Array.isArray(mod.fields)) {
                mod.fields.forEach((mf) => {
                    /** Parsed settings_override JSON for this module field. @type {object} */
                    const ov = (() => { try { return JSON.parse(mf.settings_override || '{}'); } catch (e) { return {}; } })();
                    moduleFieldOverrides[mf.field_id] = ov;
                });
            }
        }
        const ordered = Object.values(tableData.fields || {})
            .filter((x) => x && x.field_name)
            .sort((a, b) => (a.field_order ?? 999) - (b.field_order ?? 999));
        ordered.forEach((baseField) => {
            let field = baseField;
            const ov = moduleFieldOverrides[baseField.field_id];
            if (ov && Object.keys(ov).length > 0) {
                field = { ...baseField, ...ov };
            }
            if (field.primary_key === 1 || field.auto_increment === 1) return;
            if (['created_at', 'updated_at', 'deleted_at'].includes(field.field_name)) return;
            if (field.read_only === 1) return;
            const settings = parseFieldFormSettings(field);
            const rules = validationRulesFor(field);
            // Lookup fields: chat input must reference an existing parent row.
            if (field.lookup_parent_table) {
                const parentTableData = tables[field.lookup_parent_table];
                const parentTableName = (parentTableData && parentTableData.table_name) || field.lookup_parent_table;
                rules.push(`exists:${parentTableName},id`);
            }
            // required_if compiles to a Laravel rule string; base rules keep
            // 'nullable' so the engine controls when 'required' applies.
            let requiredIfRule = null;
            if (settings.required_if) {
                const ri = settings.required_if;
                if (ri.op === 'checked') requiredIfRule = `required_if:${ri.field},1`;
                else if (ri.op === 'filled') requiredIfRule = `required_with:${ri.field}`;
                else if (ri.op === 'equals') requiredIfRule = `required_if:${ri.field},${ri.value}`;
                else if (ri.op === 'in') requiredIfRule = `required_if:${ri.field},${ri.value.join(',')}`;
            }
            fields.push({
                name: field.field_name,
                label: field.caption || field.field_name.replace(/_/g, ' '),
                rules,
                required_if_rule: requiredIfRule,
                type: fieldTypeFor(field),
                required: field.required === 1 || field.required === true || field.not_null === 1,
                visible_if: settings.visible_if,
                required_if: settings.required_if,
                options: optionsFor(field),
                lookup_table: field.lookup_parent_table || null,
                lookup_caption: field.lookup_caption_1 || null,
            });
        });
        if (fields.length === 0) return;
        const slug = f.slug || f.table_name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        registry[slug] = {
            model: getModelClassName(f.table_name, tables),
            table: f.table_name,
            greeting: f.greeting,
            farewell: f.farewell,
            fields,
        };
    });
    return registry;
}

/** Map a field's IR to a chat input type. @param {object} field field row @returns {'select'|'boolean'|'email'|'date'|'number'|'decimal'|'textarea'|'text'} */
function fieldTypeFor(field) {
    const dt = (field.data_type || '').toUpperCase();
    const name = (field.field_name || '').toLowerCase();
    if (field.lookup_parent_table) return 'select';
    if (dt === 'BOOLEAN') return 'boolean';
    if (name.includes('email') || dt === 'EMAIL') return 'email';
    if (/^(DATE|DATETIME|TIMESTAMP)$/.test(dt)) return 'date';
    if (/^(INT|BIGINT|SMALLINT)$/.test(dt)) return 'number';
    if (/^(DECIMAL|NUMERIC|FLOAT|DOUBLE)$/.test(dt)) return 'decimal';
    if (dt === 'TEXT' || dt === 'LONGTEXT' || dt === 'MEDIUMTEXT') return 'textarea';
    return 'text';
}

/** Parse ';;'-separated option list values for a field. @param {object} field field row @returns {string[]|null} options, null for lookup fields */
function optionsFor(field) {
    if (field.lookup_parent_table) return null; // resolved via model at runtime
    const raw = field.options_list_values || '';
    return String(raw).split(';;').map((s) => s.trim()).filter(Boolean);
}

// PHP literal escaper for single-quoted strings.
/** @param {*} s value @returns {string} escaped for single-quoted PHP literals */
function phpEsc(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

/** Compile a {field,op,value} rule into a PHP array literal. @param {object|null} rule normalized rule @returns {string} PHP literal or 'null' */
function rulePhp(rule) {
    if (!rule) return 'null';
    if (rule.value === undefined) return `['field' => '${phpEsc(rule.field)}', 'op' => '${phpEsc(rule.op)}']`;
    if (Array.isArray(rule.value)) {
        return `['field' => '${phpEsc(rule.field)}', 'op' => '${phpEsc(rule.op)}', 'value' => [${rule.value.map((v) => `'${phpEsc(v)}'`).join(', ')}]]`;
    }
    return `['field' => '${phpEsc(rule.field)}', 'op' => '${phpEsc(rule.op)}', 'value' => '${phpEsc(rule.value)}']`;
}

/** Render the full registry as a PHP array literal for the Livewire engine. @param {object} registry from buildRegistry @returns {string} PHP array literal */
function exportRegistryPhp(registry) {
    const lines = ['['];
    Object.entries(registry).forEach(([slug, r]) => {
        lines.push(`        '${phpEsc(slug)}' => [`);
        lines.push(`            'model' => \\App\\Models\\${r.model}::class,`);
        lines.push(`            'table' => '${phpEsc(r.table)}',`);
        lines.push(`            'greeting' => '${phpEsc(r.greeting)}',`);
        lines.push(`            'farewell' => '${phpEsc(r.farewell)}',`);
        lines.push(`            'fields' => [`);
        r.fields.forEach((f) => {
            lines.push(`                ['name' => '${phpEsc(f.name)}', 'label' => '${phpEsc(f.label)}', 'type' => '${phpEsc(f.type)}', 'required' => ${f.required ? 'true' : 'false'}, 'rules' => ['${f.rules.map(phpEsc).join("', '")}'], 'required_if_rule' => ${f.required_if_rule ? `'${phpEsc(f.required_if_rule)}'` : 'null'}, 'visible_if' => ${rulePhp(f.visible_if)}, 'options' => ${f.options ? `[${f.options.map((o) => `'${phpEsc(o)}'`).join(', ')}]` : 'null'}, 'lookup_table' => ${f.lookup_table ? `'${phpEsc(f.lookup_table)}'` : 'null'}, 'lookup_caption' => ${f.lookup_caption ? `'${phpEsc(f.lookup_caption)}'` : 'null'}],`);
        });
        lines.push(`            ],`);
        lines.push(`        ],`);
    });
    lines.push('    ]');
    return lines.join('\n');
}

/**
 * Generate the Conversational Form module (Livewire engine, chat views,
 * provider) when any form opts into the conversational style.
 * @param {object} fullSchema assembled project schema
 * @param {string} outputDir generated app root
 * @returns {{success: boolean, files: string[], skipped?: boolean, error?: string}}
 */
function generateConversationalFormModule(fullSchema, outputDir) {
    try {
        const written = [];
        const registry = buildRegistry(fullSchema);
        if (Object.keys(registry).length === 0) {
            return { success: true, files: [], skipped: true };
        }

        /** Render a template to outputDir/relPath once (skips existing files). @param {string} relPath @param {string} template njk path @param {object} [context] @returns {void} */
        const emit = (relPath, template, context) => {
            const abs = path.join(outputDir, relPath);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            if (fs.existsSync(abs)) return;
            fs.writeFileSync(abs, renderTemplate(template, context || {}));
            written.push(relPath);
        };

        emit(path.join('app', 'Livewire', 'ConversationalForm.php'),
            'app/Livewire/ConversationalForm.php.njk',
            { registry_php: exportRegistryPhp(registry) });
        emit(path.join('resources', 'views', 'livewire', 'conversational-form.blade.php'),
            'resources/views/livewire/conversational-form.blade.php.njk');
        emit(path.join('resources', 'views', 'livewire', 'conversational-layout.blade.php'),
            'resources/views/livewire/conversational-layout.blade.php.njk');
        emit(path.join('app', 'Providers', 'ConversationalFormServiceProvider.php'),
            'app/Providers/ConversationalFormServiceProvider.php.njk');

        // Register provider (idempotent) + manifest.
        const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
        if (fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            if (!contents.includes('ConversationalFormServiceProvider')) {
                contents = contents.replace(/return\s*\[/, 'return [\n    App\\Providers\\ConversationalFormServiceProvider::class,');
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
        if (!manifest.providers.includes('App\\Providers\\ConversationalFormServiceProvider')) {
            manifest.providers.push('App\\Providers\\ConversationalFormServiceProvider');
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        written.push('fixzy-manifest.json');

        return { success: true, files: written };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = { generateConversationalFormModule, buildRegistry };
