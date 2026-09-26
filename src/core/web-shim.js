/**
 * Browser-side IPC shim (Phase 5.3).
 *
 * Loaded BEFORE the renderer scripts in web mode. Recreates window.electronAPI
 * (same method names as preload.js) on top of:
 *   - POST /ipc/<channel>  (invoke semantics, args as JSON array)
 *   - GET  /events         (SSE for push channels: overlay, dialogs)
 *   - send-only methods (openFolder, stopPreviewServer) map to POST too.
 */
(function () {
    'use strict';

    async function invoke(channel, ...args) {
        const res = await fetch('/ipc/' + encodeURIComponent(channel), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args),
        });
        const payload = await res.json();
        if (payload.ok) return payload.result;
        throw new Error(payload.error || 'IPC error');
    }

    const listeners = {}; // channel -> [callbacks]

    function connectEvents() {
        const es = new EventSource('/events');
        es.addEventListener('ipc', (e) => {
            try {
                const { channel, data } = JSON.parse(e.data);
                (listeners[channel] || []).forEach((cb) => cb(data));
            } catch { /* ignore malformed */ }
        });
        es.onerror = () => { /* EventSource auto-reconnects */ };
    }

    function on(channel, cb) {
        if (!listeners[channel]) listeners[channel] = [];
        listeners[channel].push(cb);
    }

    // Method map mirrors preload.js exactly (invoke channels).
    const INVOKE_METHODS = {
        openUrl: 'open-url',
        getActiveProject: 'project:get-active',
        createProject: 'project:create',
        createTable: 'table:create',
        createField: 'field:create',
        deleteTables: 'table:delete',
        deleteField: 'field:delete',
        updateFieldOrder: 'field:update-order',
        updateTableOrder: 'table:update-order',
        getAllProjects: 'projects:get-all',
        setActiveProject: 'project:set-active',
        updateProject: 'project:update',
        updateTable: 'table:update',
        updateField: 'field:update',
        updateFieldIndex: 'field:update-index',
        updateRelationship: 'relationship:update',
        upsertRelationship: 'relationship:upsert',
        deleteRelationship: 'relationship:delete',
        saveAllSettings: 'settings:save-all',
        saveMenuStructure: 'menu:save-structure',
        batchUpdate: 'database:batch-update',
        saveUnifiedMenu: 'menu:save-unified-structure',
        menuCreateGroup: 'menu:create-group',
        menuDeleteGroup: 'menu:delete-group',
        saveCustomMenuItem: 'menu:save-custom-item',
        updateIndividualMenuOrder: 'menu:update-individual-order',
        updateMenuOrder: 'menu:update-order',
        getAllSettings: 'settings:get-all',
        getFieldValidations: 'get-field-validations',
        saveFieldValidations: 'save-field-validations',
        getFullSchema: 'project:get-full-schema',
        getTablesByProject: 'tables:get-by-project',
        importSqlFile: 'sql:import-file',
        importSqlText: 'sql:import-text',
        getInitialProjectStatus: 'project:get-initial-status',
        deleteProjectSchema: 'project:delete-schema',
        parseCalculationQuery: 'sql:parse-calculation-query',
        saveCustomModule: 'custom-module:save',
        deleteCustomModule: 'custom-module:delete',
        saveCustomTableOverride: 'custom-module:save-table-override',
        saveCustomFieldOverride: 'custom-module:save-field-override',
        saveCustomView: 'custom-module:save',
        deleteCustomView: 'custom-module:delete',
        saveTableConstraint: 'table:save-constraint',
        deleteTableConstraint: 'table:delete-constraint',
        listPresets: 'preset:list',
        previewPreset: 'preset:preview',
        installPreset: 'preset:install',
        startPreview: 'preview:start',
        stopPreview: 'preview:stop',
        runInstantPreview: 'preview:instant-run',
        generateApp: 'generate-app',
        openLatestGenerated: 'generated:open-latest',
        runComposer: 'run-composer',
        saveWidget: 'widget:save',
        deleteWidget: 'widget:delete',
        setupCheck: 'setup:check',
        setupRun: 'setup:run',
    };

    // Fire-and-forget (ipcRenderer.send in preload) — mirrored as POST, result ignored.
    const SEND_METHODS = {
        openFolder: 'open-folder',
        stopPreviewServer: 'stop-preview-server',
    };

    const api = {};
    for (const [method, channel] of Object.entries(INVOKE_METHODS)) {
        api[method] = (...args) => invoke(channel, ...args);
    }
    for (const [method, channel] of Object.entries(SEND_METHODS)) {
        api[method] = (...args) => {
            invoke(channel, ...args).catch(() => {});
        };
    }

    // Push-event subscriptions (preload: ipcRenderer.on)
    api.onShowOverlay = (cb) => on('show-overlay', cb);
    api.onHideOverlay = (cb) => on('hide-overlay', cb);
    api.onShowCustomDialog = (cb) => on('show-custom-dialog', cb);
    api.onSetupLog = (cb) => on('setup-log', cb);
    api.sendCustomDialogResponse = (response) => {
        invoke('custom-dialog-response', response).catch(() => {});
    };

    // Web-mode extra: dialog responses arrive via a dedicated channel since
    // ipcMain.once can't be reached from the browser otherwise.
    window.__fsmDialogRespond = (response) => invoke('custom-dialog-response', response).catch(() => {});

    window.electronAPI = api;
    connectEvents();
})();
