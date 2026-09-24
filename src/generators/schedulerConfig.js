// Shared helpers for the Scheduler module (Fixzy SysMaker).
//
// Parses tables.scheduler_config (JSON authored by the Automation tab)
// into the schedule entries consumed by the generated ScheduleRunner
// command:
//   {
//     "reminders": [ { "field": "due_date", "offsetDays": 3, "notify": "admin" } ],
//     "recurring": { "recurrence": "monthly", "day": 1, "pauseField": "", "notify": "" }
//   }
//
// Phase 2a ships reminders; recurring is parsed here but only emitted
// once Phase 2b lands. All values are validated defensively — an invalid
// entry is dropped (with a reason) rather than crashing generation.

const pluralize = require('pluralize');

const DATE_TYPES = ['DATE', 'DATETIME', 'TIMESTAMP', 'TIMESTAMPTZ'];

function phpStr(v) {
    return String(v === null || v === undefined ? '' : v)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

/** Model class name for a table (same rule as the workflow generator). */
function modelClassName(tableName, tables) {
    if (tableName === 'users') return 'User';
    const t = (tables || {})[tableName];
    const src = (t && t.module_name && t.module_name.trim() !== '') ? t.module_name.trim() : tableName;
    const singular = pluralize.singular(src);
    return singular
        .split(/[_\s-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
}

function isDateField(fieldData) {
    const dt = String((fieldData && fieldData.data_type) || '').toUpperCase();
    return DATE_TYPES.some((d) => dt === d || dt.startsWith(d));
}

/**
 * Parse one table's scheduler_config.
 * Returns { reminders: [...], recurring: {...}|null } with only valid
 * entries, or null when nothing valid is configured.
 */
function parseSchedulerConfig(tableData, tableName, tables) {
    if (!tableData || !tableData.scheduler_config) return null;
    let cfg = null;
    try {
        cfg = JSON.parse(tableData.scheduler_config);
    } catch (e) {
        return null;
    }
    if (!cfg || typeof cfg !== 'object') return null;

    const out = { reminders: [], recurring: null };

    const fields = tableData.fields || {};
    const rawReminders = Array.isArray(cfg.reminders) ? cfg.reminders : [];
    for (const r of rawReminders) {
        if (!r || typeof r !== 'object') continue;
        const field = String(r.field || '');
        if (!/^[a-z][a-z0-9_]*$/i.test(field)) continue;
        if (!fields[field] || !isDateField(fields[field])) continue;
        let offset = parseInt(r.offsetDays, 10);
        if (!Number.isFinite(offset)) offset = 0;
        offset = Math.min(365, Math.max(0, offset));
        const notify = String(r.notify || '').trim();
        out.reminders.push({
            kind: 'reminder',
            table: tableName,
            model: modelClassName(tableName, tables),
            field,
            offsetDays: offset,
            notify,
        });
    }

    // Recurring (Phase 2b) — parsed here so the shape is stable.
    const rec = cfg.recurring;
    if (rec && typeof rec === 'object' && ['daily', 'weekly', 'monthly'].includes(rec.recurrence)) {
        out.recurring = {
            kind: 'recurring',
            table: tableName,
            model: modelClassName(tableName, tables),
            recurrence: rec.recurrence,
            day: Math.min(31, Math.max(1, parseInt(rec.day, 10) || 1)),
            weekday: Math.min(7, Math.max(1, parseInt(rec.weekday, 10) || 1)),
            notify: String(rec.notify || '').trim(),
        };
    }

    if (out.reminders.length === 0 && !out.recurring) return null;
    return out;
}

/** PHP literal for one schedule entry array element. */
function scheduleEntryPhp(entry) {
    const parts = [
        `'kind' => 'reminder'`,
        `'table' => '${phpStr(entry.table)}'`,
        `'model' => '${phpStr(entry.model)}'`,
        `'field' => '${phpStr(entry.field)}'`,
        `'offset_days' => ${entry.offsetDays}`,
        `'notify' => '${phpStr(entry.notify)}'`,
    ];
    return `        [${parts.join(', ')}],`;
}

/** PHP literal for one recurring entry. */
function recurringEntryPhp(entry) {
    const parts = [
        `'kind' => 'recurring'`,
        `'table' => '${phpStr(entry.table)}'`,
        `'model' => '${phpStr(entry.model)}'`,
        `'recurrence' => '${phpStr(entry.recurrence)}'`,
        `'day' => ${entry.day}`,
        `'weekday' => ${entry.weekday}`,
        `'notify' => '${phpStr(entry.notify)}'`,
    ];
    return `        [${parts.join(', ')}],`;
}

/**
 * Parse the project-level backup_config JSON:
 *   { "enabled": true, "frequency": "daily"|"weekly", "weekday": 1,
 *     "retention": 10, "notify": "admin" }
 * Returns a backup entry or null.
 */
function parseBackupConfig(project) {
    if (!project || !project.backup_config) return null;
    let cfg = null;
    try {
        cfg = JSON.parse(project.backup_config);
    } catch (e) {
        return null;
    }
    if (!cfg || typeof cfg !== 'object' || Number(cfg.enabled) !== 1) return null;
    const frequency = cfg.frequency === 'weekly' ? 'weekly' : 'daily';
    return {
        kind: 'backup',
        frequency,
        weekday: Math.min(7, Math.max(1, parseInt(cfg.weekday, 10) || 1)),
        retention: Math.min(60, Math.max(1, parseInt(cfg.retention, 10) || 10)),
        notify: String(cfg.notify || '').trim(),
    };
}

/** PHP literal for one backup entry. */
function backupEntryPhp(entry) {
    const parts = [
        `'kind' => 'backup'`,
        `'frequency' => '${phpStr(entry.frequency)}'`,
        `'weekday' => ${entry.weekday}`,
        `'retention' => ${entry.retention}`,
        `'notify' => '${phpStr(entry.notify)}'`,
    ];
    return `        [${parts.join(', ')}],`;
}

/**
 * Collect every schedule entry across the schema.
 * Returns [] when the scheduler module is off or nothing is configured.
 */
function collectSchedules(fullSchema) {
    const project = (fullSchema && fullSchema.project) || {};
    if (Number(project.module_scheduler) !== 1) return [];
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    const entries = [];
    for (const [tableName, t] of Object.entries(tables)) {
        const parsed = parseSchedulerConfig(t, tableName, tables);
        if (!parsed) continue;
        entries.push(...parsed.reminders);
        if (parsed.recurring) entries.push(parsed.recurring);
    }
    const backup = parseBackupConfig(project);
    if (backup) entries.push(backup);
    return entries;
}

/** Any valid schedules in the schema? */
function anySchedulesEnabled(fullSchema) {
    return collectSchedules(fullSchema).length > 0;
}

module.exports = {
    parseSchedulerConfig,
    parseBackupConfig,
    collectSchedules,
    anySchedulesEnabled,
    scheduleEntryPhp,
    recurringEntryPhp,
    backupEntryPhp,
    modelClassName,
    isDateField,
};
