import { appState } from '../state.js';
import { openGeneralQueryBuilder } from '../features/queryBuilder.js';

let isEventsAttached = false;

export function initDashboardBuilder() {
    renderDashboardWidgets();
    
    if (!isEventsAttached) {
        attachEventListeners();
        isEventsAttached = true;
    }
}

function attachEventListeners() {
       
    document.getElementById('btn-add-widget')?.addEventListener('click', () => {
        openWidgetModal();
    });

    document.getElementById('btn-close-modal-header')?.addEventListener('click', closeWidgetModal);
    document.getElementById('btn-close-modal-footer')?.addEventListener('click', closeWidgetModal);
    document.getElementById('btn-save-widget')?.addEventListener('click', saveWidgetData);

    // Dengar perubahan untuk menunjukkan/menyembunyikan input dinamik
    document.getElementById('widget-type')?.addEventListener('change', toggleWidgetFields);
    document.getElementById('widget-aggregate-type')?.addEventListener('change', toggleWidgetFields);
    
    // ▼▼▼ LOGIK BARU: Dengar perubahan Jadual dan isikan dropdown lajur ▼▼▼
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
    
    
// Butang buka Advanced Query Builder
    document.getElementById('btn-open-advanced-filter')?.addEventListener('click', () => {
        const tableName = document.getElementById('widget-target-table').value;
        if (!tableName) {
            alert("Please select a Source Table first.");
            return;
        }

        const advancedInput = document.getElementById('widget-advanced-query');

        // Panggil fungsi dengan 3 parameter: (targetTextarea, overrideTableName, customCallback)
        openGeneralQueryBuilder(advancedInput, tableName, (sql, state) => {
            if (state) {
                // Simpan JSON state ke dalam input tersembunyi
                advancedInput.value = state;
                
                // Tunjuk status bahawa Advanced Filter sedang digunakan
                document.getElementById('advanced-query-status').style.display = 'block';
                
                // Lumpuhkan basic filter
                document.getElementById('widget-filter-field').disabled = true;
                document.getElementById('widget-filter-value').disabled = true;
            }
        });
    });

    // Butang buang Advanced Filter
    document.getElementById('btn-clear-advanced-query')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('widget-advanced-query').value = '';
        document.getElementById('advanced-query-status').style.display = 'none';
        
        // Aktifkan semula basic filter
        document.getElementById('widget-filter-field').disabled = false;
        document.getElementById('widget-filter-value').disabled = false;
    });
}

// FUNGSI BARU: Isi senarai lajur berdasarkan jadual yang dipilih
function populateTableFieldsDropdown(tableName, selectedValues = {}) {
    const selects = ['widget-chart-label', 'widget-target-field', 'widget-filter-field'];
    
    // Kosongkan dahulu semua dropdown lajur
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<option value="">-- Pilih Lajur --</option>';
    });

    if (!tableName) return;

    // Dapatkan data lajur jadual dari appState
    const tableData = appState.jsonData?.database?.table?.[tableName];
    if (!tableData || !tableData.fields) return;

    const fields = Object.keys(tableData.fields);
    
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        
        fields.forEach(field => {
            const opt = document.createElement('option');
            opt.value = field;
            opt.textContent = field;
            el.appendChild(opt);
        });
        
        // Pilih nilai sedia ada jika dalam mod Edit
        if (id === 'widget-chart-label' && selectedValues.chart_label_column) el.value = selectedValues.chart_label_column;
        if (id === 'widget-target-field' && selectedValues.target_field) el.value = selectedValues.target_field;
        if (id === 'widget-filter-field' && selectedValues.filter_field) el.value = selectedValues.filter_field;
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
        
        // Tunjukkan info tapisan tambahan di UI Kad
let extraInfo = '';
    if (widget.filter_field && widget.filter_value) {
        extraInfo = `<br><small class="text-info"><i class="fa fa-filter"></i> Filter: ${widget.filter_field} ${widget.filter_operator} '${widget.filter_value}'</small>`;
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
                            Jadual: <strong>${widget.target_table}</strong> | Aggregate: <strong>${widget.aggregate_type || 'N/A'}</strong>
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
    
// ▼▼▼ LOGIK RESET TAB PINTAR ▼▼▼
    // Kita arahkan sistem untuk seolah-olah "menekan" butang tab pertama secara automatik
    const basicTabBtn = document.querySelector('.tab-link[data-tab="tab-widget-basic"]');
    if (basicTabBtn) basicTabBtn.click();
    // ▲▲▲ TAMAT LOGIK RESET TAB ▲▲▲

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
            
            // Masukkan data Lanjutan
            populateTableFieldsDropdown(widget.target_table, {
                chart_label_column: widget.chart_label_column,
                target_field: widget.target_field,
                filter_field: widget.filter_field
            });
            document.getElementById('widget-filter-operator').value = widget.filter_operator || '=';
            document.getElementById('widget-filter-value').value = widget.filter_value || '';
            document.getElementById('widget-timeframe').value = widget.timeframe_range || 'all';
// ▼▼▼ TAMBAH DI SINI: Proses Load Data Advanced Query ▼▼▼
            const advancedQueryInput = document.getElementById('widget-advanced-query');
            const advancedStatus = document.getElementById('advanced-query-status');
            const basicField = document.getElementById('widget-filter-field');
            const basicValue = document.getElementById('widget-filter-value');

            advancedQueryInput.value = widget.advanced_query || '';
            
            // Jika ada data Advanced Query, paparkan lencana hijau dan lumpuhkan basic filter
            if (widget.advanced_query) {
                advancedStatus.style.display = 'block';
                basicField.disabled = true;
                basicValue.disabled = true;
            } else {
                advancedStatus.style.display = 'none';
                basicField.disabled = false;
                basicValue.disabled = false;
            }
            // ▲▲▲ TAMAT TAMBAHAN ▲▲▲            
            document.getElementById('widget-modal-title').textContent = 'Edit Widget';
        }
    } else {
        document.getElementById('form-widget-settings').reset();
        document.getElementById('widget-id').value = '';
        populateTableFieldsDropdown(''); // Kosongkan
// ▼▼▼ TAMBAH DI SINI: Proses Reset untuk Widget Baru ▼▼▼
        document.getElementById('widget-advanced-query').value = '';
        document.getElementById('advanced-query-status').style.display = 'none';
        document.getElementById('widget-filter-field').disabled = false;
        document.getElementById('widget-filter-value').disabled = false;
        // ▲▲▲ TAMAT TAMBAHAN ▲▲▲
        document.getElementById('widget-modal-title').textContent = 'Add New Widget';
    }

    toggleWidgetFields();
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

    // 1. Kawalan Logik Jadual Terkini
    if (type === 'table_latest') {
        aggregateSelect.disabled = true;
        aggregateSelect.value = '';
    } else {
        aggregateSelect.disabled = false;
    }

    // 2. Kawalan Logik Paparan Carta
    if (type === 'chart_bar' || type === 'chart_pie') {
        if(groupChart) groupChart.style.display = 'block';
    } else {
        if(groupChart) groupChart.style.display = 'none';
        document.getElementById('widget-chart-label').value = '';
    }

    // 3. Kawalan Logik Target Field (Hanya untuk SUM/AVG)
    if (aggregateVal === 'sum' || aggregateVal === 'avg') {
        if(groupTargetField) groupTargetField.style.display = 'block';
    } else {
        if(groupTargetField) groupTargetField.style.display = 'none';
        document.getElementById('widget-target-field').value = '';
    }
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
        
        // Data Baharu
        chart_label_column: document.getElementById('widget-chart-label').value,
        target_field: document.getElementById('widget-target-field').value,
        filter_field: document.getElementById('widget-filter-field').value,
        filter_operator: document.getElementById('widget-filter-operator').value,
        filter_value: document.getElementById('widget-filter-value').value,
        timeframe_range: document.getElementById('widget-timeframe').value,
        
        // ▼▼▼ TAMBAH DI SINI: Tarik nilai dari input tersembunyi ▼▼▼
        advanced_query: document.getElementById('widget-advanced-query').value
        // ▲▲▲ TAMAT TAMBAHAN ▲▲▲
    };

    if (!widgetData.title || !widgetData.target_table) {
        alert("Please fill in the Title and Source Table!");
        return;
    }
    
    // Validasi tambahan
    if ((widgetData.aggregate_type === 'sum' || widgetData.aggregate_type === 'avg') && !widgetData.target_field) {
        alert("For SUM or AVG calculations, please select a Target Column.");
        return;
    }
    
    if ((widgetData.widget_type === 'chart_bar' || widgetData.widget_type === 'chart_pie') && !widgetData.chart_label_column) {
        alert("For Charts, selecting a 'Group Data By' column is mandatory.");
        return;
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
            alert("Ralat menyimpan widget: " + response.message);
        }
    } catch (err) {
        console.error("Gagal menyimpan widget:", err);
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
        console.error("Gagal memadam widget:", err);
    }
}