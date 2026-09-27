// numberingConfig.js — IR helpers for the Auto Numbering module.
//
// Per-table config (tables.numbering_config JSON):
//   {
//     field:       "invoice_no",   // column to fill on create
//     prefix:      "INV",         // literal prefix
//     date_token:  "YYYYMM",      // "" | "YYYY" | "YYYYMM" | "YYYYMMDD"
//     width:       4,             // zero-padded sequence width (1..8)
//     reset:       "monthly"      // "never" | "daily" | "monthly" | "yearly"
//   }
//
// Example: INV-202609-0001. The period key (prefix + token value)
// scopes the sequence so counters reset per period.

/**
 * Parse a table's auto-numbering config from numbering_enabled + numbering_config.
 * @param {object} tableData row from the tables store
 * @returns {{field: string, prefix: string, date_token: string, width: number, reset: string}|null} null when disabled/invalid
 */
function parseNumberingConfig(tableData) {
    if (!tableData || Number(tableData.numbering_enabled) !== 1) return null;
    let cfg = null;
    try {
        cfg = typeof tableData.numbering_config === 'string'
            ? JSON.parse(tableData.numbering_config)
            : tableData.numbering_config;
    } catch (e) { cfg = null; }
    if (!cfg || typeof cfg !== 'object') return null;
    const field = String(cfg.field || '').trim();
    if (!field || !/^[a-z_][a-z0-9_]*$/i.test(field)) return null;
    const prefix = String(cfg.prefix || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
    const token = ['YYYY', 'YYYYMM', 'YYYYMMDD'].includes(cfg.date_token) ? cfg.date_token : '';
    let width = parseInt(cfg.width, 10);
    if (!Number.isFinite(width)) width = 4;
    width = Math.min(8, Math.max(1, width));
    const reset = ['never', 'daily', 'monthly', 'yearly'].includes(cfg.reset) ? cfg.reset : (token === 'YYYYMMDD' ? 'daily' : token === 'YYYYMM' ? 'monthly' : token === 'YYYY' ? 'yearly' : 'never');
    return { field, prefix, date_token: token, width, reset };
}

/** @param {object} fullSchema @returns {boolean} true if any table enables auto numbering */
function anyNumberingEnabled(fullSchema) {
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    return Object.values(tables).some((t) => parseNumberingConfig(t) !== null);
}

// PHP literal for embedding a config array in generated code.
/** @param {object|null} cfg parsed numbering config @returns {string} PHP array literal or 'null' */
function numberingConfigPhp(cfg) {
    if (!cfg) return 'null';
    return `['field' => '${cfg.field}', 'prefix' => '${cfg.prefix}', 'date_token' => '${cfg.date_token}', 'width' => ${cfg.width}, 'reset' => '${cfg.reset}']`;
}

module.exports = { parseNumberingConfig, anyNumberingEnabled, numberingConfigPhp };
