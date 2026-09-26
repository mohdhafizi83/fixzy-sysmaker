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
 * Returns [{ nameSource, tableData }] for:
 *  - each base table where parseFn(tableData) is truthy
 *  - each custom module whose OWN settings_override contains enabledKey
 *    and where parseFn({...tableData, ...overrides}) is truthy
 */
function collectFeatureSources(tables, parseFn, enabledKey) {
    const sources = [];
    for (const tableName in tables) {
        if (tableName === 'users') continue;
        const tableData = tables[tableName];
        if (parseFn(tableData)) {
            const nameSource = (tableData.module_name && tableData.module_name.trim() !== '')
                ? tableData.module_name : tableName;
            sources.push({ nameSource, tableData });
        }
        if (Array.isArray(tableData.custom_modules)) {
            for (const mod of tableData.custom_modules) {
                let overrides = {};
                try { overrides = JSON.parse(mod.settings_override || '{}'); } catch (e) { overrides = {}; }
                if (overrides[enabledKey] === undefined) continue; // module did not opt in
                const virtualTable = { ...tableData, ...overrides };
                if (parseFn(virtualTable)) {
                    sources.push({ nameSource: mod.module_name, tableData: virtualTable });
                }
            }
        }
    }
    return sources;
}

module.exports = { collectFeatureSources };
