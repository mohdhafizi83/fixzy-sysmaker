import { appState } from '../state.js';

let isEventsAttached = false; // Elak event terpasang berkali-kali

export function initDashboardBuilder() {
    renderDashboardWidgets();
    
    // Pasang Event Listener (Patuh CSP) hanya sekali
    if (!isEventsAttached) {
        attachEventListeners();
        isEventsAttached = true;
    }
}

function attachEventListeners() {
    // 1. Butang Tambah Widget
    document.getElementById('btn-add-widget')?.addEventListener('click', () => {
        openWidgetModal();
    });

    // 2. Butang Tutup Modal
    document.getElementById('btn-close-modal-header')?.addEventListener('click', closeWidgetModal);
    document.getElementById('btn-close-modal-footer')?.addEventListener('click', closeWidgetModal);

    // 3. Butang Simpan
    document.getElementById('btn-save-widget')?.addEventListener('click', saveWidgetData);

    // 4. Perubahan Jenis Widget (onchange)
    document.getElementById('widget-type')?.addEventListener('change', toggleWidgetFields);

    // 5. Event Delegation untuk Butang Edit & Delete (Kerana ia dilukis secara dinamik)
    const container = document.getElementById('widget-list-container');
    if (container) {
        container.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-edit-widget');
            if (editBtn) openWidgetModal(parseInt(editBtn.dataset.id));

            const delBtn = e.target.closest('.btn-delete-widget');
            if (delBtn) deleteWidget(parseInt(delBtn.dataset.id));
        });
    }
}

// ==========================================
// 1. LUKIS SENARAI WIDGET (RENDER)
// ==========================================
export function renderDashboardWidgets() {
    const container = document.getElementById('widget-list-container');
    if (!container) return;

    container.innerHTML = ''; 
    const widgets = appState.jsonData?.database?.widgets || [];

    if (widgets.length === 0) {
        container.innerHTML = `<div class="col-12 text-center text-muted mt-4"><p>Tiada widget. Klik "+ Tambah Widget" untuk bermula.</p></div>`;
        return;
    }

    widgets.sort((a, b) => a.sort_order - b.sort_order).forEach(widget => {
        const colSize = widget.width_span === 'full' ? 'col-12' : (widget.width_span === '2' ? 'col-md-8' : 'col-md-4');
        const badgeColor = widget.widget_type === 'stats' ? 'primary' : (widget.widget_type === 'table_latest' ? 'success' : 'info');
        
        // Perhatikan: Tiada lagi onclick di sini. Kita guna class dan data-id
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
                        </p>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}

// ==========================================
// 2. KAWALAN MODAL & BORANG
// ==========================================
function openWidgetModal(widgetId = null) {
    const tableSelect = document.getElementById('widget-target-table');
    tableSelect.innerHTML = '';
    
    const tables = appState.jsonData?.database?.table || {};
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Sila Pilih Jadual --';
    tableSelect.appendChild(defaultOption);

    for (const tableName in tables) {
        const option = document.createElement('option');
        option.value = tableName;
        option.textContent = tableName;
        tableSelect.appendChild(option);
    }

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
            document.getElementById('widget-modal-title').textContent = 'Sunting Widget';
        }
    } else {
        document.getElementById('form-widget-settings').reset();
        document.getElementById('widget-id').value = '';
        document.getElementById('widget-modal-title').textContent = 'Tambah Widget Baru';
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
    
    if (type === 'table_latest') {
        aggregateSelect.disabled = true;
        aggregateSelect.value = '';
    } else {
        aggregateSelect.disabled = false;
    }
}

// ==========================================
// 3. SIMPAN & PADAM
// ==========================================
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
        icon: document.getElementById('widget-icon').value
    };

    if (!widgetData.title || !widgetData.target_table) {
        alert("Sila isi Tajuk dan Jadual Sumber!");
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
    if (!confirm("Anda pasti mahu memadam widget ini?")) return;
    
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