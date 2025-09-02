// FIND AND REPLACE THE ENTIRETY OF workflowBuilder.js WITH THIS CODE

import { openModalLogicBuilder } from './uiHandlers.js';
import { jsonData } from './js.main.js';

/**
 * Fungsi teras yang boleh diguna semula untuk menyediakan satu instans workflow builder.
 * @param {object} config - Objek konfigurasi untuk instans ini.
 * @param {string} config.containerId - ID elemen div utama untuk builder ini.
 * @param {string} config.hiddenInputId - ID input tersembunyi untuk menyimpan data JSON.
 * @param {string} config.hookType - Jenis hook ('project' atau 'table').
 */
function setupBuilderInstance(config) {
    const container = document.getElementById(config.containerId);
    if (!container) return;

    const state = {
        blocks: {},
        connections: [],
        selectedConnection: null,
        draggedBlock: null,
        isConnecting: false,
        startPoint: null,
        tempLine: null,
        canvas: container.querySelector('.workflow-canvas'),
        svg: container.querySelector('.connector-svg'),
        offsetX: 0,
        offsetY: 0,
    };

    const saveState = () => {
        const workflowData = {
            blocks: state.blocks,
            connections: state.connections.map(c => ({ fromBlock: c.fromBlock, fromPoint: c.fromPoint, toBlock: c.toBlock, toPoint: c.toPoint }))
        };
        const workflowJson = JSON.stringify(workflowData, null, 2);
        const targetInput = document.getElementById(config.hiddenInputId);

        if(targetInput) {
            targetInput.value = workflowJson;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    const getPointPosition = (pointEl) => {
        const canvasRect = state.canvas.getBoundingClientRect();
        const pointRect = pointEl.getBoundingClientRect();
        return {
            x: pointRect.left - canvasRect.left + pointRect.width / 2,
            y: pointRect.top - canvasRect.top + pointRect.height / 2,
        };
    };

    const createConnectorPath = (startPos, endPos, connection) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const c1x = startPos.x + Math.abs(endPos.x - startPos.x) * 0.6;
        const c1y = startPos.y;
        const c2x = endPos.x - Math.abs(endPos.x - startPos.x) * 0.6;
        const c2y = endPos.y;
        path.setAttribute('d', `M ${startPos.x} ${startPos.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endPos.x} ${endPos.y}`);
        path.classList.add('connector-path');
        path.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.selectedConnection?.path) state.selectedConnection.path.classList.remove('selected');
            state.selectedConnection = connection;
            path.classList.add('selected');
        });
        return path;
    };

    const redrawConnections = () => {
        state.svg.innerHTML = '';
        state.connections.forEach(conn => {
            const startPointEl = container.querySelector(`[data-block-id='${conn.fromBlock}'] [data-point-id='${conn.fromPoint}']`);
            const endPointEl = container.querySelector(`[data-block-id='${conn.toBlock}'] [data-point-id='${conn.toPoint}']`);
            if (startPointEl && endPointEl) {
                const startPos = getPointPosition(startPointEl);
                const endPos = getPointPosition(endPointEl);
                const path = createConnectorPath(startPos, endPos, conn);
                conn.path = path;
                state.svg.appendChild(path);
            }
        });
    };
    
    const updateBlockConnections = (blockId) => {
        state.connections.forEach(conn => {
            if (conn.fromBlock === blockId || conn.toBlock === blockId) {
                const startPointEl = container.querySelector(`[data-block-id='${conn.fromBlock}'] [data-point-id='${conn.fromPoint}']`);
                const endPointEl = container.querySelector(`[data-block-id='${conn.toBlock}'] [data-point-id='${conn.toPoint}']`);
                if (startPointEl && endPointEl && conn.path) {
                    const startPos = getPointPosition(startPointEl);
                    const endPos = getPointPosition(endPointEl);
                    const c1x = startPos.x + Math.abs(endPos.x - startPos.x) * 0.6;
                    const c1y = startPos.y;
                    const c2x = endPos.x - Math.abs(endPos.x - startPos.x) * 0.6;
                    const c2y = endPos.y;
                    conn.path.setAttribute('d', `M ${startPos.x} ${startPos.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endPos.x} ${endPos.y}`);
                }
            }
        });
    };

    function deleteBlock(blockId) {
        container.querySelector(`[data-block-id='${blockId}']`)?.remove();
        delete state.blocks[blockId];
        state.connections = state.connections.filter(conn => conn.fromBlock !== blockId && conn.toBlock !== blockId);
        redrawConnections();
        saveState();
    }

    function deleteSelectedConnection() {
        if (!state.selectedConnection) return;
        const connIndex = state.connections.findIndex(c => c === state.selectedConnection);
        if (connIndex > -1) {
            state.connections.splice(connIndex, 1);
            state.selectedConnection = null;
            redrawConnections();
            saveState();
        }
    }
    
    function createWorkflowBlock(type, x, y, existingId = null, existingData = null) {
        const blockId = existingId || `block_${new Date().getTime()}`;
        const block = document.createElement('div');
        block.className = 'workflow-block';
        block.dataset.blockId = blockId;
        block.dataset.blockType = type;
        block.style.left = `${x}px`;
        block.style.top = `${y}px`;

        if (!existingId) {
            state.blocks[blockId] = { type, x, y, ...existingData };
        }
        
        const blockState = state.blocks[blockId];
        let title = '';
        let content = '';
        let connectionPoints = '';

        switch (type) {
            case 'hook_trigger':
                const hookName = blockState.hook_type ? `<strong>${blockState.hook_type}</strong>` : '<em>Not Configured</em>';
                title = `<i class="fas fa-play-circle"></i> Trigger`;
                content = `<p style="margin:0; font-size: 0.9em;">${hookName}</p><button class="btn btn-secondary btn-sm configure-btn mt-1">Configure</button>`;
                connectionPoints += '<div class="connection-point output" data-point-id="out"></div>';
                break;
            case 'action':
                title = '<i class="fas fa-bolt"></i> Action';
                content = '<button class="btn btn-secondary btn-sm configure-btn">Configure</button>';
                connectionPoints += '<div class="connection-point input" data-point-id="in"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out"></div>';
                break;
            case 'condition':
                title = '<i class="fas fa-code-branch"></i> Condition';
                content = '<button class="btn btn-secondary btn-sm configure-btn">Configure</button>';
                connectionPoints += '<div class="connection-point input" data-point-id="in"></div>';
                connectionPoints += '<div class="connection-point output true" data-point-id="out-true" title="True"></div>';
                connectionPoints += '<div class="connection-point output false" data-point-id="out-false" title="False"></div>';
                break;
        }

        block.innerHTML = `
            <button class="delete-block-btn" title="Delete Block">&times;</button>
            <div class="workflow-block-title">${title}</div>
            <div class="workflow-block-content">${content}</div>
            <div class="connection-point-container">${connectionPoints}</div>
        `;

        block.querySelector('.workflow-block-title').addEventListener('mousedown', startDragBlock);
        block.querySelectorAll('.connection-point').forEach(p => p.addEventListener('mousedown', startConnecting));

        return block;
    }

    function openHookTypeModal(blockId) {
        const modal = document.getElementById('hook-type-modal');
        const blockData = state.blocks[blockId];
        if (!modal || !blockData) return;

        const elements = {
            projectOptions: document.getElementById('project-hook-options'),
            tableOptions: document.getElementById('table-hook-options'),
            okBtn: document.getElementById('hook-type-modal-ok'),
            cancelBtn: document.getElementById('hook-type-modal-cancel'),
            closeBtn: document.getElementById('hook-type-modal-close'),
        };
        
        elements.projectOptions.classList.toggle('hidden', config.hookType !== 'project');
        elements.tableOptions.classList.toggle('hidden', config.hookType !== 'table');

        const currentSelection = modal.querySelector(`input[name="hook_selection"][value="${blockData.hook_type}"]`);
        if (currentSelection) currentSelection.checked = true;

        const closeModal = () => modal.classList.add('hidden');
        
        const okHandler = () => {
            const selected = modal.querySelector('input[name="hook_selection"]:checked');
            if (selected) {
                blockData.hook_type = selected.value;
                const blockEl = container.querySelector(`[data-block-id='${blockId}'] .workflow-block-content`);
                if (blockEl) {
                    blockEl.querySelector('p').innerHTML = `<strong>${selected.value}</strong>`;
                }
                saveState();
            }
            closeModal();
        };

        const newOkBtn = elements.okBtn.cloneNode(true);
        elements.okBtn.parentNode.replaceChild(newOkBtn, elements.okBtn);
        newOkBtn.addEventListener('click', okHandler);

        elements.cancelBtn.addEventListener('click', closeModal, { once: true });
        elements.closeBtn.addEventListener('click', closeModal, { once: true });
        
        modal.classList.remove('hidden');
    }
    
    function openBlockConfiguration(blockId) {
        const blockType = state.blocks[blockId]?.type;
        if (blockType === 'hook_trigger') {
            openHookTypeModal(blockId);
            return;
        }
        
        // Seterusnya adalah logik sedia ada untuk blok Condition/Action
        const blockData = state.blocks[blockId];
        if (!blockData) return;
        let tempInput = document.getElementById('workflow-temp-input');
        if (!tempInput) {
            tempInput = document.createElement('input');
            tempInput.type = 'hidden'; tempInput.id = 'workflow-temp-input';
            document.body.appendChild(tempInput);
        }
        tempInput.value = blockData.configData || '[]';
        const CONDITION_BLOCK_GRAMMAR = {
            'start': ['value', 'open_paren'],
            'value': ['comparison_operator', 'arithmetic_operator', 'logical_operator', 'close_paren'],
            'comparison_operator': ['value', 'open_paren'],
            'arithmetic_operator': ['value', 'open_paren'],
            'logical_operator': ['value', 'open_paren'],
            'open_paren': ['value', 'open_paren'],
            'close_paren': ['comparison_operator', 'arithmetic_operator', 'logical_operator', 'close_paren'],
        };
        openModalLogicBuilder({
            modalId: 'algorithm-builder-modal',
            getContext: () => ({ tableName: config.hookType === 'table' ? document.querySelector('#table-settings-page .table-name')?.textContent : null }),
            closeButtonId: 'algorithm-builder-close',
            cancelButtonId: 'algorithm-builder-cancel-btn',
            doneButtonId: 'algorithm-builder-done-btn',
            targetInputId: 'workflow-temp-input',
            validationRules: CONDITION_BLOCK_GRAMMAR,
            hiddenComponents: ['if', 'else_if', 'then', 'else'],
            onComplete: (logicJson) => {
                state.blocks[blockId].configData = logicJson;
                const blockEl = container.querySelector(`[data-block-id='${blockId}']`);
                if (blockEl) {
                    const btn = blockEl.querySelector('.configure-btn');
                    btn.textContent = 'Configured';
                    btn.classList.replace('btn-secondary', 'btn-success');
                }
                saveState();
            }
        });
    }

    function startDragBlock(e) {
        if (e.target.classList.contains('connection-point') || e.target.classList.contains('delete-block-btn')) return;
        e.preventDefault();
        e.stopPropagation();
        state.draggedBlock = e.target.closest('.workflow-block');
        const rect = state.draggedBlock.getBoundingClientRect();
        state.offsetX = e.clientX - rect.left;
        state.offsetY = e.clientY - rect.top;
        document.addEventListener('mousemove', dragBlock);
        document.addEventListener('mouseup', stopDragBlock, { once: true });
    }
    
    function dragBlock(e) {
        if (!state.draggedBlock) return;
        const canvasRect = state.canvas.getBoundingClientRect();
        let newX = e.clientX - canvasRect.left - state.offsetX;
        let newY = e.clientY - canvasRect.top - state.offsetY;
        newX = Math.max(0, Math.round(newX / 10) * 10);
        newY = Math.max(0, Math.round(newY / 10) * 10);
        state.draggedBlock.style.left = `${newX}px`;
        state.draggedBlock.style.top = `${newY}px`;
        const blockId = state.draggedBlock.dataset.blockId;
        state.blocks[blockId].x = newX;
        state.blocks[blockId].y = newY;
        updateBlockConnections(blockId);
    }

    function stopDragBlock() {
        document.removeEventListener('mousemove', dragBlock);
        state.draggedBlock = null;
        saveState();
    }

    function startConnecting(e) {
        if (!e.target.classList.contains('output')) return;
        e.preventDefault();
        e.stopPropagation();
        state.isConnecting = true;
        state.startPoint = e.target;
        const startPos = getPointPosition(state.startPoint);
        state.tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        state.tempLine.setAttribute('x1', startPos.x);
        state.tempLine.setAttribute('y1', startPos.y);
        state.tempLine.setAttribute('x2', startPos.x);
        state.tempLine.setAttribute('y2', startPos.y);
        state.tempLine.classList.add('temp-connector');
        state.svg.appendChild(state.tempLine);
        document.addEventListener('mousemove', drawTempConnector);
        document.addEventListener('mouseup', endConnecting, { once: true });
    }

    function drawTempConnector(e) {
        if (!state.isConnecting) return;
        const canvasRect = state.canvas.getBoundingClientRect();
        const endPos = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
        state.tempLine.setAttribute('x2', endPos.x);
        state.tempLine.setAttribute('y2', endPos.y);
    }

    function endConnecting(e) {
        if (!state.isConnecting) return;
        state.svg.removeChild(state.tempLine);
        const endPoint = e.target;
        if (endPoint.classList.contains('input') && state.startPoint.closest('.workflow-block') !== endPoint.closest('.workflow-block')) {
            const fromBlock = state.startPoint.closest('.workflow-block').dataset.blockId;
            const fromPoint = state.startPoint.dataset.pointId;
            const toBlock = endPoint.closest('.workflow-block').dataset.blockId;
            const toPoint = endPoint.dataset.pointId;
            if (!state.connections.some(c => c.toBlock === toBlock && c.toPoint === toPoint)) {
                state.connections.push({ fromBlock, fromPoint, toBlock, toPoint, path: null });
                redrawConnections();
                saveState();
            }
        }
        state.isConnecting = false;
        state.startPoint = null;
        state.tempLine = null;
        document.removeEventListener('mousemove', drawTempConnector);
    }

    // --- Inisialisasi Event Listeners untuk Instans Ini ---
    container.querySelectorAll('.workflow-block-palette-item').forEach(item => {
        item.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', e.target.dataset.blockType));
    });

    state.canvas.addEventListener('dragover', (e) => e.preventDefault());

    state.canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const blockType = e.dataTransfer.getData('text/plain');
        const canvasRect = state.canvas.getBoundingClientRect();
        const x = e.clientX - canvasRect.left;
        const y = e.clientY - canvasRect.top;
        const newBlock = createWorkflowBlock(blockType, x, y);
        state.canvas.appendChild(newBlock);
        saveState();
    });

    state.canvas.addEventListener('click', (e) => {
        const configureBtn = e.target.closest('.configure-btn');
        const deleteBtn = e.target.closest('.delete-block-btn');
        if (configureBtn) {
            openBlockConfiguration(configureBtn.closest('.workflow-block').dataset.blockId);
        } else if (deleteBtn) {
            deleteBlock(deleteBtn.closest('.workflow-block').dataset.blockId);
        }
    });
    
    document.addEventListener('keydown', (e) => {
        const isTabActive = container.closest('.tab-pane')?.classList.contains('active');
        const isPageActive = !container.closest('#table-settings-page')?.classList.contains('hidden');
        if ((isTabActive || isPageActive) && (e.key === 'Delete' || e.key === 'Backspace')) {
             deleteSelectedConnection();
        }
    });

    state.canvas.addEventListener('mousedown', (e) => {
        if (e.target === state.canvas && state.selectedConnection) {
            state.selectedConnection.path.classList.remove('selected');
            state.selectedConnection = null;
        }
    });

    // --- Muatkan Data Awal ---
    const hiddenInput = document.getElementById(config.hiddenInputId);
    try {
        const workflowData = JSON.parse(hiddenInput.value || '{}');
        if (workflowData.blocks) {
            state.blocks = workflowData.blocks;
            for (const blockId in state.blocks) {
                const blockInfo = state.blocks[blockId];
                const newBlock = createWorkflowBlock(blockInfo.type, blockInfo.x, blockInfo.y, blockId);
                if (blockInfo.configData && blockInfo.configData !== '[]') {
                    const btn = newBlock.querySelector('.configure-btn');
                    if(btn) {
                        btn.textContent = 'Configured';
                        btn.classList.replace('btn-secondary', 'btn-success');
                    }
                }
                state.canvas.appendChild(newBlock);
            }
        }
        state.connections = workflowData.connections || [];
        redrawConnections();
    } catch (e) { console.warn("Could not load workflow state:", e); }
}

/**
 * Fungsi utama untuk memulakan kedua-dua workflow builder.
 */
export function initializeWorkflowBuilder() {
    setupBuilderInstance({
        containerId: 'project-workflow-container',
        hiddenInputId: 'app-hook-logic',
        hookType: 'project'
    });

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const tablePage = mutation.target;
                if (!tablePage.classList.contains('hidden')) {
                    if (!tablePage.dataset.workflowInitialized) {
                        setupBuilderInstance({
                            containerId: 'table-workflow-container',
                            hiddenInputId: 'tbl-hook-logic',
                            hookType: 'table'
                        });
                        tablePage.dataset.workflowInitialized = 'true';
                    }
                }
            }
        }
    });

    const tableSettingsPage = document.getElementById('table-settings-page');
    if (tableSettingsPage) {
        observer.observe(tableSettingsPage, { attributes: true });
    }
}