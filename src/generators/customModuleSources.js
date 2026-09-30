// customModuleSources.js — shared helper for standalone-page generators
// (calendar / tree / kanban).
//
// These generators used to scan base tables only. With Custom Module full
// parity they must ALSO emit a page per custom module that opts into the
// feature via its own settings_override. A module must carry the feature's
// enabled flag in its OWN override — we never inherit the flag from the
// table, or every module would duplicate the main module's page.
'use strict';

/**
 * Returns [{ nameSource, modelSource, tableData }] for:
 *  - each base table where parseFn(tableData) is truthy
 *  - each custom module whose OWN settings_override contains enabledKey
 *    and where parseFn({...tableData, ...overrides}) is truthy
 *
 * modelSource = the module_name of the BASE table (the Eloquent model that
 * actually exists). Custom modules share the base table's model — naming a
 * page's model after the custom module name (e.g. MatriksPapan) produces
 * "Class App\Models\MatriksPapan not found" at page load (found via grid
 * view browser audit, 2026-09-30).
 */
function collectFeatureSources(tables, parseFn, enabledKey) {
    const sources = [];
    for (const tableName in tables) {
        if (tableName === 'users') continue;
        const tableData = tables[tableName];
        const baseModelSource = (tableData.module_name && tableData.module_name.trim() !== '')
            ? tableData.module_name : tableName;
        if (parseFn(tableData)) {
            const nameSource = baseModelSource;
            sources.push({ nameSource, modelSource: baseModelSource, tableData });
        }
        if (Array.isArray(tableData.custom_modules)) {
            for (const mod of tableData.custom_modules) {
                let overrides = {};
                try { overrides = JSON.parse(mod.settings_override || '{}'); } catch (e) { overrides = {}; }
                if (overrides[enabledKey] === undefined) continue; // module did not opt in
                const virtualTable = { ...tableData, ...overrides };
                if (parseFn(virtualTable)) {
                    sources.push({ nameSource: mod.module_name, modelSource: baseModelSource, tableData: virtualTable });
                }
            }
        }
    }
    return sources;
}

module.exports = { collectFeatureSources };
