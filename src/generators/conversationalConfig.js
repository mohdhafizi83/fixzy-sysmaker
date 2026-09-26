// conversationalConfig.js — IR helpers for the Conversational Form module (E6).
//
// A table opts in via tables.form_layout_config JSON with
//   { "style": "conversational", "chat": { "greeting": "...", "farewell": "..." } }
// The generated app exposes a Livewire chat page at /chat/{slug} that asks
// the table's form fields one at a time, validates per step, honours
// visible_if / required_if rules, then creates the record.

const { parseFormLayoutConfig } = require('./formLayoutConfig');

function parseConversationalConfig(tableData) {
    const cfg = parseFormLayoutConfig(tableData);
    if (!cfg || cfg.style !== 'conversational') return null;
    const chat = cfg.chat || {};
    return {
        slug: cfg.slug || null,
        greeting: chat.greeting || 'Hi! Let us collect a few details.',
        farewell: chat.farewell || 'Thank you! Your submission has been recorded.',
    };
}

function parseJsonSafe(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

// Conversational config for one custom module. Only the module's OWN
// settings_override.form_layout_config counts here — we deliberately do NOT
// fall back to the table config, because the main module already owns the
// table's chat route. Auto-inheriting would duplicate routes unexpectedly.
function parseModuleConversationalConfig(moduleObj) {
    const overrides = parseJsonSafe(moduleObj.settings_override) || {};
    if (!overrides.form_layout_config) return null;
    const cfg = parseJsonSafe(overrides.form_layout_config);
    if (!cfg || cfg.style !== 'conversational') return null;
    const chat = cfg.chat || {};
    let slug = cfg.slug || null;
    if (!slug) {
        slug = String(moduleObj.module_name || '')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    if (!slug) return null;
    return {
        slug,
        greeting: chat.greeting || 'Hi! Let us collect a few details.',
        farewell: chat.farewell || 'Thank you! Your submission has been recorded.',
    };
}

function collectConversationalForms(fullSchema) {
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    const out = [];
    Object.entries(tables).forEach(([tableName, t]) => {
        const cfg = parseConversationalConfig(t);
        if (cfg) out.push({ table_name: tableName, ...cfg });
        // Custom modules with an overridden conversational layout get their
        // own chat entry (own slug + module field overrides applied).
        if (Array.isArray(t.custom_modules)) {
            t.custom_modules.forEach((mod) => {
                const mcfg = parseModuleConversationalConfig(mod);
                if (mcfg) out.push({ table_name: tableName, module_id: mod.module_id, module_name: mod.module_name, ...mcfg });
            });
        }
    });
    // Deterministic slug de-collision: first occurrence keeps the slug,
    // later collisions get -2, -3, ... appended.
    const seen = new Map();
    out.forEach((f) => {
        let slug = f.slug;
        if (seen.has(slug)) {
            let n = 2;
            while (seen.has(`${slug}-${n}`)) n++;
            slug = `${slug}-${n}`;
            f.slug = slug;
        }
        seen.set(slug, true);
    });
    return out;
}

function anyConversationalEnabled(fullSchema) {
    return collectConversationalForms(fullSchema).length > 0;
}

module.exports = { parseConversationalConfig, collectConversationalForms, anyConversationalEnabled };
