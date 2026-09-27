// apiConfig.js — IR helpers for the REST API module.
//
// Per-table: tables.api_enabled (0/1) + tables.api_config (JSON):
//   {
//     "read_roles":  ["admin"],          // Shield role names allowed GET
//     "write_roles": ["admin"],          // Shield role names allowed POST/PUT
//     "fields":      ["nama", "kod"],    // allowlist (empty = all non-sensitive)
//     "rate_limit":  60                  // requests/min per token (0 = default)
//   }
//
// Sensitive columns (password/token/secret-like) are NEVER exposed even
// if listed — enforced at generation time, not runtime config.

const SENSITIVE_RE = /(password|passwd|secret|token|api_key|apikey|private_key|otp|pin$)/i;

/**
 * Parse a table's API profile from api_enabled + api_config JSON.
 * @param {object} tableData row from `tables` with api_enabled/api_config
 * @returns {{readRoles: string[], writeRoles: string[], fields: string[], rateLimit: number}|null} null when API disabled
 */
function getApiProfile(tableData) {
    if (!tableData || !Number(tableData.api_enabled)) return null;
    let cfg = {};
    try {
        cfg = typeof tableData.api_config === 'string' ? JSON.parse(tableData.api_config || '{}') : (tableData.api_config || {});
    } catch (e) {
        cfg = {};
    }
    return {
        readRoles: Array.isArray(cfg.read_roles) ? cfg.read_roles.filter((r) => typeof r === 'string' && r.trim()) : [],
        writeRoles: Array.isArray(cfg.write_roles) ? cfg.write_roles.filter((r) => typeof r === 'string' && r.trim()) : [],
        fields: Array.isArray(cfg.fields) ? cfg.fields.filter((f) => typeof f === 'string') : [],
        rateLimit: Number(cfg.rate_limit) > 0 ? Number(cfg.rate_limit) : 60,
    };
}

// Field allowlist resolution: explicit list ∩ existing fields, minus
// sensitive columns. Empty explicit list = all non-sensitive fields.
/**
 * Resolve which fields the API may expose for a table.
 * @param {object} tableData table row with fields map
 * @param {object|null} profile profile from getApiProfile
 * @returns {string[]} allowed field names
 */
function resolveApiFields(tableData, profile) {
    const allFields = Object.keys((tableData && tableData.fields) || {});
    const safe = allFields.filter((f) => !SENSITIVE_RE.test(f));
    if (!profile || !profile.fields || profile.fields.length === 0) return safe;
    return profile.fields.filter((f) => safe.includes(f));
}

/** True when the table has api_enabled set. @param {object} tableData @returns {boolean} */
function isApiEnabled(tableData) {
    return getApiProfile(tableData) !== null;
}

// Any table in the schema has the API on?
/** @param {object} fullSchema assembled project schema @returns {boolean} true if any table enables the API */
function anyApiEnabled(fullSchema) {
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    return Object.values(tables).some((t) => isApiEnabled(t));
}

module.exports = {
    SENSITIVE_RE,
    getApiProfile,
    resolveApiFields,
    isApiEnabled,
    anyApiEnabled,
};
