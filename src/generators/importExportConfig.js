// importExportConfig.js — IR helpers for the Smart Import/Export module.
//
// Per-table config (tables.import_config JSON):
//   {
//     match_field:  "email",   // column used to find an existing row
//     mode:         "update",  // update | skip | insert
//     dry_run:      false      // default for the dry-run checkbox
//   }
//
// Semantics (baked into the generated Importer's resolveRecord):
//   - No config            → legacy behaviour: firstOrNew on the
//     table's unique constraint (golden-stable, unchanged).
//   - mode=update          → match found → update; else insert.
//   - mode=skip            → match found → row skipped; else insert.
//   - mode=insert          → always insert a new row.
//
// Export: Filament v5's Exporter already offers CSV *and* XLSX natively
// (getFormats), so no extra dependency is needed — the generated
// exporter exposes both formats automatically.

function parseImportConfig(tableData) {
    if (!tableData || Number(tableData.import_enabled) !== 1) return null;
    let cfg = {};
    if (tableData.import_config) {
        try {
            cfg = typeof tableData.import_config === 'string'
                ? JSON.parse(tableData.import_config)
                : tableData.import_config;
        } catch (e) {
            cfg = {};
        }
    }
    const matchField = String(cfg.match_field || '').trim();
    const mode = ['update', 'skip', 'insert'].includes(cfg.mode) ? cfg.mode : 'update';
    if (mode !== 'insert' && matchField === '') {
        // A match field is required for update/skip; fall back to the
        // legacy unique-constraint behaviour instead of a broken profile.
        return null;
    }
    return {
        match_field: matchField,
        mode,
        dry_run: cfg.dry_run === true || cfg.dry_run === 'true',
    };
}

function anyImportProfilesEnabled(fullSchema) {
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    return Object.values(tables).some((t) => parseImportConfig(t) !== null);
}

// PHP literal for the baked profile (null → legacy path).
function importConfigPhp(cfg) {
    if (!cfg) return 'null';
    return `['match_field' => ${JSON.stringify(cfg.match_field)}, 'mode' => ${JSON.stringify(cfg.mode)}, 'dry_run' => ${cfg.dry_run ? 'true' : 'false'}]`;
}

module.exports = {
    parseImportConfig,
    anyImportProfilesEnabled,
    importConfigPhp,
};
