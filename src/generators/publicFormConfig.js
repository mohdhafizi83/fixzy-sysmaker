// publicFormConfig.js — IR helpers for the Public Intake Form module.
//
// Per-table config (tables.public_form_config JSON):
//   {
//     slug:              "complaints"        (URL segment /f/{slug})
//     allowed_fields:    ["name","email",…]  (public-insertable columns)
//     intro_text:        "…"                 (shown above the form)
//     success_text:      "…"                 (shown after submit)
//     captcha_required:  true|false
//     status_field_default: "pending"        (status set on insert)
//     lookup_enabled:    true|false         (public status-check page)
//   }
//
// The generated app stores a random public_reference per submission
// (added via migration when a public form is enabled) so lookups can be
// matched without exposing the internal id.

function parsePublicFormConfig(tableData) {
    if (!tableData || Number(tableData.public_form_enabled) !== 1) return null;
    let cfg = tableData.public_form_config;
    if (typeof cfg === 'string') {
        try { cfg = JSON.parse(cfg); } catch (e) { cfg = null; }
    }
    if (!cfg || typeof cfg !== 'object') return null;
    const slug = String(cfg.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
    if (!slug) return null;
    const allowed = Array.isArray(cfg.allowed_fields) ? cfg.allowed_fields.filter((f) => typeof f === 'string' && f) : [];
    if (allowed.length === 0) return null;
    return {
        slug,
        allowed_fields: allowed,
        intro_text: String(cfg.intro_text || ''),
        success_text: String(cfg.success_text || ''),
        captcha_required: cfg.captcha_required === true || cfg.captcha_required === 1 || cfg.captcha_required === '1',
        status_field_default: String(cfg.status_field_default || ''),
        lookup_enabled: cfg.lookup_enabled === true || cfg.lookup_enabled === 1 || cfg.lookup_enabled === '1',
    };
}

function anyPublicFormEnabled(fullSchema) {
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    return Object.values(tables).some((t) => parsePublicFormConfig(t) !== null);
}

// Collect all enabled public forms keyed by slug (for route registration).
function collectPublicForms(fullSchema) {
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    const out = [];
    Object.entries(tables).forEach(([tableName, t]) => {
        const cfg = parsePublicFormConfig(t);
        if (cfg) out.push({ table_name: tableName, ...cfg });
    });
    return out;
}

module.exports = { parsePublicFormConfig, anyPublicFormEnabled, collectPublicForms };
