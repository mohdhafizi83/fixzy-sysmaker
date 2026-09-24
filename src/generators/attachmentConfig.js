// Shared helpers for the Attachments module (Fixzy SysMaker).
//
// Two ways to enable attachments on a table:
//   1. Table-level: tables.attachments_enabled = 1 (generic manager)
//   2. Field-level: a field with media_type === 'attachments'
// Both converge on the same polymorphic Attachment model + RelationManager.
//
// Field options (fields.attach_* columns):
//   attach_max_files  INTEGER (1-50, default 10)
//   attach_types      TEXT    comma-separated extensions, empty = any
//   attach_max_size   INTEGER KB per file (default 10240)

function tableHasAttachments(tableData) {
    if (!tableData) return false;
    if (Number(tableData.attachments_enabled) === 1) return true;
    const fields = tableData.fields || {};
    return Object.values(fields).some((f) => f.media_type === 'attachments');
}

/**
 * Generic table-level attachments (RelationManager) — ONLY the table
 * flag, not field-level attachment fields. Field-level attachments are
 * handled by their own FileUpload field; emitting the manager for both
 * would show two upload UIs on the same record.
 */
function tableUsesGenericAttachments(tableData) {
    return !!tableData && Number(tableData.attachments_enabled) === 1;
}

function anyAttachmentsEnabled(fullSchema) {
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    // Shared module files (model, controller, provider, manager, migration)
    // are only needed for the generic table-level manager. Field-level
    // attachment fields store JSON paths in their own column and need
    // none of it.
    return Object.values(tables).some((t) => tableUsesGenericAttachments(t));
}

/**
 * Resolve upload options for a table. When several attachment fields exist,
 * the most permissive values win (max files = highest, size = highest,
 * types = union; any empty-types field means "any type allowed").
 */
function attachmentOptions(tableData) {
    const fields = (tableData && tableData.fields) || {};
    let maxFiles = 10;
    let maxSizeKb = 10240;
    let types = null; // null = any
    let sawTypedField = false;

    Object.values(fields).forEach((f) => {
        if (f.media_type !== 'attachments') return;
        sawTypedField = true;
        const mf = parseInt(f.attach_max_files, 10);
        if (Number.isFinite(mf)) maxFiles = Math.max(maxFiles, Math.min(50, Math.max(1, mf)));
        const ms = parseInt(f.attach_max_size, 10);
        if (Number.isFinite(ms) && ms > 0) maxSizeKb = Math.max(maxSizeKb, ms);
        if (f.attach_types && String(f.attach_types).trim() !== '') {
            const list = String(f.attach_types).split(',').map((s) => s.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
            if (list.length > 0) {
                types = types || new Set();
                list.forEach((t) => types.add(t));
            }
        }
    });

    // Table-level enable with no attachment fields: defaults.
    if (!sawTypedField) {
        return { maxFiles: 10, maxSizeKb: 10240, allowedTypes: [] };
    }
    return { maxFiles, maxSizeKb, allowedTypes: types ? Array.from(types) : [] };
}

module.exports = {
    tableHasAttachments,
    tableUsesGenericAttachments,
    anyAttachmentsEnabled,
    attachmentOptions,
};
