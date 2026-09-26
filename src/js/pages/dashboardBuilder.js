import { appState } from '../state.js';
import { openGeneralQueryBuilder } from '../features/queryBuilder.js';

let isEventsAttached = false;

export function initDashboardBuilder() {
    renderDashboardWidgets();
    initKioskControls();
    
    if (!isEventsAttached) {
        attachEventListeners();
        isEventsAttached = true;
    }
}

function initKioskControls() {
    const enabledEl = document.getElementById('kiosk-enabled');
    if (!enabledEl) return;
    const project = appState.jsonData?.project || {};
    enabledEl.checked = Number(project.kiosk_enabled) === 1;
    document.getElementById('kiosk-rotate-seconds').value = String(project.kiosk_rotate_seconds || 15);
    document.getElementById('kiosk-page-size').value = String(project.kiosk_page_size || 4);
    toggleKioskGroups();

    const saveKiosk = async () => {
        const payload = {
            project_id: appState.activeProject?.project_id,
            kiosk_enabled: enabledEl.checked ? 1 : 0,
            kiosk_rotate_seconds: parseInt(document.getElementById('kiosk-rotate-seconds').value, 10) || 15,
            kiosk_page_size: parseInt(document.getElementById('kiosk-page-size').value, 10) || 4,
        };
        if (!payload.project_id) return;
        try {
            const res = await window.electronAPI.updateProject(payload);
            if (res && res.success) {
                // Mirror into the in-memory schema so generation sees it.
                if (appState.jsonData) {
                    appState.jsonData.project = { ...(appState.jsonData.project || {}), ...payload };
                }
            }
        } catch (err) {
            console.error('Failed to save kiosk settings:', err);
        }
    };

    const toggleKioskGroups = () => {
        const on = enabledEl.checked;
        document.getElementById('kiosk-rotate-group').style.display = on ? 'block' : 'none';
        document.getElementById('kiosk-pagesize-group').style.display = on ? 'block' : 'none';
    };

    enabledEl.removeEventListener('change', saveKiosk);
    enabledEl.removeEventListener('change', toggleKioskGroups);
    enabledEl.addEventListener('change', () => { toggleKioskGroups(); saveKiosk(); });
    document.getElementById('kiosk-rotate-seconds').removeEventListener('change', saveKiosk);
    document.getElementById('kiosk-rotate-seconds').addEventListener('change', saveKiosk);
    document.getElementById('kiosk-page-size').removeEventListener('change', saveKiosk);
    document.getElementById('kiosk-page-size').addEventListener('change', saveKiosk);
}

function attachEventListeners() {
       
    document.getElementById('btn-add-widget')?.addEventListener('click', () => {
        openWidgetModal();
    });

    document.getElementById('btn-close-modal-header')?.addEventListener('click', closeWidgetModal);
    document.getElementById('btn-close-modal-footer')?.addEventListener('click', closeWidgetModal);
    document.getElementById('btn-save-widget')?.addEventListener('click', saveWidgetData);

    // Listen for changes to show/hide dynamic inputs
    document.getElementById('widget-type')?.addEventListener('change', toggleWidgetFields);
    document.getElementById('widget-aggregate-type')?.addEventListener('change', toggleWidgetFields);
    document.getElementById('widget-refresh-mode')?.addEventListener('change', toggleRefreshFields);
    
    // ▼▼▼ NEW LOGIC: Listen for table changes and populate the column dropdown ▼▼▼
    document.getElementById('widget-target-table')?.addEventListener('change', (e) => {
        populateTableFieldsDropdown(e.target.value);
    });

    const container = document.getElementById('widget-list-container');
    if (container) {
        container.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-edit-widget');
            if (editBtn) openWidgetModal(parseInt(editBtn.dataset.id));

            const delBtn = e.target.closest('.btn-delete-widget');
            if (delBtn) deleteWidget(parseInt(delBtn.dataset.id));
        });
    }
    
    
// Button to open the Advanced Query Builder
    document.getElementById('btn-open-advanced-filter')?.addEventListener('click', () => {
        const tableName = document.getElementById('widget-target-table').value;
        if (!tableName) {
            alert("Please select a Source Table first.");
            return;
        }

        const advancedInput = document.getElementById('widget-advanced-query');

        // Call the function with 3 parameters: (targetTextarea, overrideTableName, customCallback)
        openGeneralQueryBuilder(advancedInput, tableName, (sql, state) => {
            if (state) {
                // Save the JSON state into the hidden input
                advancedInput.value = state;
                
                // Show the status that the Advanced Filter is in use
                document.getElementById('advanced-query-status').style.display = 'block';
                
                // Disable the basic filter
                document.getElementById('widget-filter-field').disabled = true;
                document.getElementById('widget-filter-value').disabled = true;
            }
        });
    });

    // Button to remove the Advanced Filter
    document.getElementById('btn-clear-advanced-query')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('widget-advanced-query').value = '';
        document.getElementById('advanced-query-status').style.display = 'none';
        
        // Re-enable the basic filter
        document.getElementById('widget-filter-field').disabled = false;
        document.getElementById('widget-filter-value').disabled = false;
    });
}

// NEW FUNCTION: Fill the column list based on the selected table
function populateTableFieldsDropdown(tableName, selectedValues = {}) {
    const selects = ['widget-chart-label', 'widget-target-field', 'widget-filter-field'];
    // Numeric-only selects for scatter/bubble/combo axes.
    const numericSelects = ['widget-series-field', 'widget-size-field'];

    // First clear all column dropdowns
    [...selects, ...numericSelects].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<option value="">-- Select Column --</option>';
    });

    if (!tableName) return;

    // Get the table's column data from appState
    const tableData = appState.jsonData?.database?.table?.[tableName];
    if (!tableData || !tableData.fields) return;

    const NUMERIC_TYPES = ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'NUMBER', 'NUMERIC'];
    const isNumeric = (f) => NUMERIC_TYPES.includes(String(f.data_type || '').toUpperCase());

    const fields = Object.keys(tableData.fields);
    const numericFields = fields.filter((name) => isNumeric(tableData.fields[name]));

    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        fields.forEach(field => {
            const opt = document.createElement('option');
            opt.value = field;
            opt.textContent = field;
            el.appendChild(opt);
        });
    });

    numericSelects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        numericFields.forEach(field => {
            const opt = document.createElement('option');
            opt.value = field;
            opt.textContent = field;
            el.appendChild(opt);
        });
    });

    // Select the existing value if in Edit mode
    const selectedMap = {
        'widget-chart-label': selectedValues.chart_label_column,
        'widget-target-field': selectedValues.target_field,
        'widget-filter-field': selectedValues.filter_field,
        'widget-series-field': selectedValues.chart_series_field,
        'widget-size-field': selectedValues.chart_size_field,
    };
    Object.entries(selectedMap).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el && val) el.value = val;
    });
}

export function renderDashboardWidgets() {
    const container = document.getElementById('widget-list-container');
    if (!container) return;

    container.innerHTML = ''; 
    const widgets = appState.jsonData?.database?.widgets || [];

if (widgets.length === 0) {
        container.innerHTML = `<div class="col-12 text-center text-muted mt-4"><p>No widgets found. Click "+ Add Widget" to get started.</p></div>`;
        return;
    }

    widgets.sort((a, b) => a.sort_order - b.sort_order).forEach(widget => {
        const colSize = widget.width_span === 'full' ? 'col-12' : (widget.width_span === '2' ? 'col-md-8' : 'col-md-4');
        const badgeColor = widget.widget_type === 'stats' ? 'primary' : (widget.widget_type === 'table_latest' ? 'success' : 'info');
        
        // Show extra filter info on the card UI
let extraInfo = '';
    if (widget.filter_field && widget.filter_value) {
        extraInfo = `<br><small class="text-info"><i class="fa fa-filter"></i> Filter: ${widget.filter_field} ${widget.filter_operator} '${widget.filter_value}'</small>`;
    }
    if (widget.refresh_mode === 'live') {
        extraInfo += ` <span class="badge badge-warning">⚡ live</span>`;
    } else if (widget.refresh_mode === 'poll') {
        extraInfo += ` <span class="badge badge-secondary">↻ ${widget.refresh_interval || 10}s</span>`;
    }

        const cardHTML = `
            <div class="${colSize} mb-3">
                <div class="card shadow-sm border-${widget.color || 'primary'}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0">
                                <span class="badge badge-${badgeColor} mr-2">${widget.widget_type}</span>
                                ${widget.title}
                            </h5>
                            <div>
                                <button class="btn btn-sm btn-outline-secondary btn-edit-widget" data-id="${widget.id}">✏️</button>
                                <button class="btn btn-sm btn-outline-danger btn-delete-widget" data-id="${widget.id}">🗑️</button>
                            </div>
                        </div>
                        <p class="text-muted mt-2 mb-0 text-sm">
                            Table: <strong>${widget.target_table}</strong> | Aggregate: <strong>${widget.aggregate_type || 'N/A'}</strong>
                            ${extraInfo}
                        </p>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}

function openWidgetModal(widgetId = null) {
    const tableSelect = document.getElementById('widget-target-table');
    tableSelect.innerHTML = '<option value="">-- Select Source Table --</option>';
    
    const tables = appState.jsonData?.database?.table || {};
   
    for (const tableName in tables) {
        const option = document.createElement('option');
        option.value = tableName;
        option.textContent = tableName;
        tableSelect.appendChild(option);
    }
    
// ▼▼▼ SMART TAB RESET LOGIC ▼▼▼
    // We make the system act as if it "clicked" the first tab button automatically
    const basicTabBtn = document.querySelector('.tab-link[data-tab="tab-widget-basic"]');
    if (basicTabBtn) basicTabBtn.click();
    // ▲▲▲ END TAB RESET LOGIC ▲▲▲

    if (widgetId) {
        const widgetsList = appState.jsonData?.database?.widgets || [];
        const widget = widgetsList.find(w => w.id === widgetId);
        
        if (widget) {
            document.getElementById('widget-id').value = widget.id;
            document.getElementById('widget-title').value = widget.title;
            document.getElementById('widget-type').value = widget.widget_type;
            document.getElementById('widget-target-table').value = widget.target_table;
            document.getElementById('widget-aggregate-type').value = widget.aggregate_type || 'count';
            document.getElementById('widget-width-span').value = widget.width_span || '1';
            document.getElementById('widget-color').value = widget.color || 'primary';
            document.getElementById('widget-icon').value = widget.icon || '';
            
            // Enter the advanced data
            populateTableFieldsDropdown(widget.target_table, {
                chart_label_column: widget.chart_label_column,
                target_field: widget.target_field,
                filter_field: widget.filter_field,
                chart_series_field: widget.chart_series_field,
                chart_size_field: widget.chart_size_field
            });
            document.getElementById('widget-filter-operator').value = widget.filter_operator || '=';
            document.getElementById('widget-filter-value').value = widget.filter_value || '';
            document.getElementById('widget-timeframe').value = widget.timeframe_range || 'all';
            document.getElementById('widget-series-agg').value = widget.series_aggregate_type || 'sum';
            document.getElementById('widget-refresh-mode').value = widget.refresh_mode || 'static';
            document.getElementById('widget-refresh-interval').value = String(widget.refresh_interval || 10);
// ▼▼▼ ADDED HERE: Advanced Query data load process ▼▼▼
            const advancedQueryInput = document.getElementById('widget-advanced-query');
            const advancedStatus = document.getElementById('advanced-query-status');
            const basicField = document.getElementById('widget-filter-field');
            const basicValue = document.getElementById('widget-filter-value');

            advancedQueryInput.value = widget.advanced_query || '';
            
            // If Advanced Query data exists, show the green badge and disable the basic filter
            if (widget.advanced_query) {
                advancedStatus.style.display = 'block';
                basicField.disabled = true;
                basicValue.disabled = true;
            } else {
                advancedStatus.style.display = 'none';
                basicField.disabled = false;
                basicValue.disabled = false;
            }
            // ▲▲▲ END ADDITION ▲▲▲            
            document.getElementById('widget-modal-title').textContent = 'Edit Widget';
        }
    } else {
        document.getElementById('form-widget-settings').reset();
        document.getElementById('widget-id').value = '';
        populateTableFieldsDropdown(''); // Clear
// ▼▼▼ ADDED HERE: Reset process for a new Widget ▼▼▼
        document.getElementById('widget-advanced-query').value = '';
        document.getElementById('advanced-query-status').style.display = 'none';
        document.getElementById('widget-filter-field').disabled = false;
        document.getElementById('widget-filter-value').disabled = false;
        // ▲▲▲ END ADDITION ▲▲▲
        document.getElementById('widget-modal-title').textContent = 'Add New Widget';
    }

    toggleWidgetFields();
    toggleRefreshFields();
    document.getElementById('modal-widget-settings').style.display = 'block';
}

function closeWidgetModal() {
    document.getElementById('modal-widget-settings').style.display = 'none';
}

function toggleWidgetFields() {
    const type = document.getElementById('widget-type').value;
    const aggregateSelect = document.getElementById('widget-aggregate-type');
    const aggregateVal = aggregateSelect.value;

    const groupChart = document.getElementById('group-chart-label');
    const groupTargetField = document.getElementById('group-target-field');
    const groupSeriesField = document.getElementById('group-series-field');
    const groupSeriesAgg = document.getElementById('group-series-agg');
    const groupSizeField = document.getElementById('group-size-field');

    const XY_TYPES = ['chart_scatter', 'chart_bubble'];
    const GROUPED_CHART_TYPES = ['chart_bar', 'chart_pie', 'chart_doughnut', 'chart_polar', 'chart_line', 'chart_area', 'chart_radar', 'chart_combo'];
    const isChart = type.startsWith('chart_');

    // 1. Aggregate control — scatter/bubble plot raw points, no aggregation.
    if (type === 'table_latest' || XY_TYPES.includes(type)) {
        aggregateSelect.disabled = true;
        aggregateSelect.value = '';
    } else {
        aggregateSelect.disabled = false;
    }

    // 2. Group-by label (grouped charts only).
    if (GROUPED_CHART_TYPES.includes(type)) {
        if (groupChart) groupChart.style.display = 'block';
    } else {
        if (groupChart) groupChart.style.display = 'none';
        document.getElementById('widget-chart-label').value = '';
    }

    // 3. Target Field: SUM/AVG for non-charts, X-axis for scatter/bubble.
    if (XY_TYPES.includes(type)) {
        if (groupTargetField) {
            groupTargetField.style.display = 'block';
            const lbl = groupTargetField.querySelector('label');
            if (lbl) lbl.textContent = 'X-Axis Column (Numeric)';
        }
    } else if (aggregateVal === 'sum' || aggregateVal === 'avg') {
        if (groupTargetField) {
            groupTargetField.style.display = 'block';
            const lbl = groupTargetField.querySelector('label');
            if (lbl) lbl.textContent = 'Target Column (SUM/AVG)';
        }
    } else {
        if (groupTargetField) {
            groupTargetField.style.display = 'none';
            document.getElementById('widget-target-field').value = '';
        }
    }

    // 4. Second numeric field: Y-axis (scatter/bubble) or line overlay (combo).
    if (XY_TYPES.includes(type) || type === 'chart_combo') {
        if (groupSeriesField) {
            groupSeriesField.style.display = 'block';
            const lbl = document.getElementById('label-series-field');
            if (lbl) lbl.textContent = type === 'chart_combo' ? 'Line Overlay Column (Numeric)' : 'Y-Axis Column (Numeric)';
        }
    } else {
        if (groupSeriesField) groupSeriesField.style.display = 'none';
        document.getElementById('widget-series-field').value = '';
    }

    // 5. Combo line series aggregate.
    if (type === 'chart_combo') {
        if (groupSeriesAgg) groupSeriesAgg.style.display = 'block';
    } else {
        if (groupSeriesAgg) groupSeriesAgg.style.display = 'none';
        document.getElementById('widget-series-agg').value = 'sum';
    }

    // 6. Bubble size column.
    if (type === 'chart_bubble') {
        if (groupSizeField) groupSizeField.style.display = 'block';
    } else {
        if (groupSizeField) groupSizeField.style.display = 'none';
        document.getElementById('widget-size-field').value = '';
    }

    // Charts (non-scatter) with count aggregate don't need a target column —
    // keep the label sane.
    if (isChart && !XY_TYPES.includes(type) && aggregateVal === 'count') {
        if (groupTargetField) groupTargetField.style.display = 'none';
    }
}

function toggleRefreshFields() {
    const mode = document.getElementById('widget-refresh-mode').value;
    const intervalGroup = document.getElementById('group-refresh-interval');
    const notice = document.getElementById('live-realtime-notice');
    if (intervalGroup) intervalGroup.style.display = mode === 'poll' ? 'block' : 'none';
    if (notice) notice.style.display = mode === 'live' ? 'block' : 'none';
}

async function saveWidgetData() {
    const widgetData = {
        id: document.getElementById('widget-id').value,
        project_id: appState.activeProject.project_id, 
        title: document.getElementById('widget-title').value,
        widget_type: document.getElementById('widget-type').value,
        target_table: document.getElementById('widget-target-table').value,
        aggregate_type: document.getElementById('widget-aggregate-type').value,
        width_span: document.getElementById('widget-width-span').value,
        color: document.getElementById('widget-color').value,
        icon: document.getElementById('widget-icon').value,
        
        // New data
        chart_label_column: document.getElementById('widget-chart-label').value,
        target_field: document.getElementById('widget-target-field').value,
        filter_field: document.getElementById('widget-filter-field').value,
        filter_operator: document.getElementById('widget-filter-operator').value,
        filter_value: document.getElementById('widget-filter-value').value,
        timeframe_range: document.getElementById('widget-timeframe').value,
        chart_series_field: document.getElementById('widget-series-field').value,
        chart_size_field: document.getElementById('widget-size-field').value,
        series_aggregate_type: document.getElementById('widget-series-agg').value,
        refresh_mode: document.getElementById('widget-refresh-mode').value,
        refresh_interval: parseInt(document.getElementById('widget-refresh-interval').value, 10) || 10,
        
        // ▼▼▼ ADDED HERE: Pull the value from the hidden input ▼▼▼
        advanced_query: document.getElementById('widget-advanced-query').value
        // ▲▲▲ END ADDITION ▲▲▲
    };

    if (!widgetData.title || !widgetData.target_table) {
        alert("Please fill in the Title and Source Table!");
        return;
    }
    
    // Additional validation
    const XY_TYPES = ['chart_scatter', 'chart_bubble'];
    const GROUPED_CHART_TYPES = ['chart_bar', 'chart_pie', 'chart_doughnut', 'chart_polar', 'chart_line', 'chart_area', 'chart_radar', 'chart_combo'];

    if (XY_TYPES.includes(widgetData.widget_type)) {
        if (!widgetData.target_field || !widgetData.chart_series_field) {
            alert("Scatter and Bubble charts need both an X-Axis and a Y-Axis numeric column.");
            return;
        }
        if (widgetData.widget_type === 'chart_bubble' && !widgetData.chart_size_field) {
            alert("Bubble charts need a Bubble Size column.");
            return;
        }
    } else {
        if ((widgetData.aggregate_type === 'sum' || widgetData.aggregate_type === 'avg') && !widgetData.target_field) {
            alert("For SUM or AVG calculations, please select a Target Column.");
            return;
        }
        if (GROUPED_CHART_TYPES.includes(widgetData.widget_type) && !widgetData.chart_label_column) {
            alert("For Charts, selecting a 'Group Data By' column is mandatory.");
            return;
        }
        if (widgetData.widget_type === 'chart_combo' && !widgetData.chart_series_field) {
            alert("Combo charts need a Line Overlay column.");
            return;
        }
    }

    try {
        const response = await window.electronAPI.saveWidget(widgetData);
        if (response.success) {
            if (!appState.jsonData.database.widgets) appState.jsonData.database.widgets = [];
            
            if (widgetData.id) {
                const index = appState.jsonData.database.widgets.findIndex(w => w.id == widgetData.id);
                if (index !== -1) appState.jsonData.database.widgets[index] = response.data;
            } else {
                appState.jsonData.database.widgets.push(response.data);
            }
            
            closeWidgetModal();
            renderDashboardWidgets();
        } else {
            alert("Error saving widget: " + response.message);
        }
    } catch (err) {
        console.error("Failed to save widget:", err);
    }
}

async function deleteWidget(widgetId) {
    if (!confirm("Are you sure you want to delete this widget?")) return;
    
    try {
        const response = await window.electronAPI.deleteWidget(widgetId);
        if (response.success) {
            appState.jsonData.database.widgets = appState.jsonData.database.widgets.filter(w => w.id !== widgetId);
            renderDashboardWidgets();
        }
    } catch (err) {
        console.error("Failed to delete widget:", err);
    }
}