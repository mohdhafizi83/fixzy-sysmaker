/**
 * FiziSysMaker - Hook Workflow Builder
 * Modul untuk menguruskan UI dan logik untuk workflow builder visual.
 */
import { openModalLogicBuilder } from './uiHandlers.js';
import { jsonData, activeProject, SaveManager } from './js.main.js';

// State variables for the builder
let state = {
    isDraggingBlock: false,
    isConnecting: false,
    draggedBlock: null,
    startPoint: null,
    tempLine: null,
    canvas: null,
    canvasWrapper: null,
    svg: null,
    offsetX: 0,
    offsetY: 0,
    scale: 1, 
    blocks: {},
    connections: [],
    currentHookType: null, // 'project' or 'table'
    selectedConnection: null,
};

// --- UTILITY FUNCTIONS ---

function getPointPosition(pointEl) {
    const canvasRect = state.canvas.getBoundingClientRect();
    const pointRect = pointEl.getBoundingClientRect();
    return {
        x: pointRect.left - canvasRect.left + pointRect.width / 2,
        y: pointRect.top - canvasRect.top + pointRect.height / 2,
    };
}

function createConnectorPath(startPos, endPos, connection) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const c1x = startPos.x + Math.abs(endPos.x - startPos.x) * 0.6;
    const c1y = startPos.y;
    const c2x = endPos.x - Math.abs(endPos.x - startPos.x) * 0.6;
    const c2y = endPos.y;
    const d = `M ${startPos.x} ${startPos.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endPos.x} ${endPos.y}`;
    path.setAttribute('d', d);
    path.classList.add('connector-path');
    path.addEventListener('click', (e) => {
        e.stopPropagation();
        selectConnection(path, connection);
    });
    return path;
}

function redrawConnections() {
    state.svg.innerHTML = '';
    state.connections.forEach(conn => {
        const startPointEl = document.querySelector(`[data-block-id='${conn.fromBlock}'] [data-point-id='${conn.fromPoint}']`);
        const endPointEl = document.querySelector(`[data-block-id='${conn.toBlock}'] [data-point-id='${conn.toPoint}']`);
        if (startPointEl && endPointEl) {
            const startPos = getPointPosition(startPointEl);
            const endPos = getPointPosition(endPointEl);
            const path = createConnectorPath(startPos, endPos, conn);
            conn.path = path;
            state.svg.appendChild(path);
        }
    });
}

function updateBlockConnections(blockId) {
    state.connections.forEach(conn => {
        if (conn.fromBlock === blockId || conn.toBlock === blockId) {
            const startPointEl = document.querySelector(`[data-block-id='${conn.fromBlock}'] [data-point-id='${conn.fromPoint}']`);
            const endPointEl = document.querySelector(`[data-block-id='${conn.toBlock}'] [data-point-id='${conn.toPoint}']`);
            if (startPointEl && endPointEl && conn.path) {
                const startPos = getPointPosition(startPointEl);
                const endPos = getPointPosition(endPointEl);
                const c1x = startPos.x + Math.abs(endPos.x - startPos.x) * 0.6;
                const c1y = startPos.y;
                const c2x = endPos.x - Math.abs(endPos.x - startPos.x) * 0.6;
                const c2y = endPos.y;
                const d = `M ${startPos.x} ${startPos.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endPos.x} ${endPos.y}`;
                conn.path.setAttribute('d', d);
            }
        }
    });
}

// --- BLOCK AND CONNECTION DELETION ---

function deleteBlock(blockId) {
    document.querySelector(`[data-block-id='${blockId}']`)?.remove();
    delete state.blocks[blockId];
    state.connections = state.connections.filter(conn => conn.fromBlock !== blockId && conn.toBlock !== blockId);
    redrawConnections();
}

function selectConnection(path, connection) {
    if (state.selectedConnection && state.selectedConnection.path) {
        state.selectedConnection.path.classList.remove('selected');
    }
    state.selectedConnection = connection;
    path.classList.add('selected');
}

function deleteSelectedConnection() {
    if (!state.selectedConnection) return;
    const connIndex = state.connections.findIndex(c => c === state.selectedConnection);
    if (connIndex > -1) {
        state.connections.splice(connIndex, 1);
        state.selectedConnection = null;
        redrawConnections();
    }
}

// --- BLOCK CONFIGURATION ---

function openBlockConfiguration(blockId) {
    const blockData = state.blocks[blockId];
    if (!blockData) return;

    let tempInput = document.getElementById('workflow-temp-input');
    if (!tempInput) {
        tempInput = document.createElement('input');
        tempInput.type = 'hidden';
        tempInput.id = 'workflow-temp-input';
        document.body.appendChild(tempInput);
    }
    tempInput.value = blockData.configData || '[]';

    const validationRules = {
        'start': ['if', 'open_paren', 'value'],
        'if': ['value', 'open_paren'],
        'value': ['comparison_operator', 'arithmetic_operator', 'logical_operator', 'then'],
        'comparison_operator': ['value', 'open_paren'],
        'arithmetic_operator': ['value', 'open_paren'],
        'logical_operator': ['value', 'open_paren', 'if'],
        'open_paren': ['value', 'if', 'open_paren'],
    };

    const config = {
        modalId: 'algorithm-builder-modal',
        getContext: () => ({
            tableName: state.currentHookType === 'table' ? document.querySelector('#table-settings-page .table-name')?.textContent : null
        }),
        closeButtonId: 'algorithm-builder-close',
        cancelButtonId: 'algorithm-builder-cancel-btn',
        doneButtonId: 'algorithm-builder-done-btn',
        targetInputId: 'workflow-temp-input',
        validationRules: validationRules,
        onComplete: (logicJson) => {
            state.blocks[blockId].configData = logicJson;
            const blockEl = document.querySelector(`[data-block-id='${blockId}']`);
            if (blockEl) {
                const btn = blockEl.querySelector('.configure-btn');
                btn.textContent = 'Configured';
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-success');
            }
        }
    };

    openModalLogicBuilder(config);
}


// --- WORKFLOW SAVE AND LOAD ---

function clearCanvas() {
    state.canvas.querySelectorAll('.workflow-block:not([data-block-type="start"])').forEach(el => el.remove());
    state.blocks = {};
    state.connections = [];
    redrawConnections();
}

function loadWorkflow(workflowData) {
    clearCanvas();
    if (!workflowData || !workflowData.blocks) return;

    state.blocks = workflowData.blocks;

    for (const blockId in state.blocks) {
        const blockInfo = state.blocks[blockId];
        
        // Skip creating the START block if it's loaded from data, as it's static HTML
        if (blockInfo.type === 'start') {
            continue;
        }

        const newBlock = createWorkflowBlock(blockInfo.type, blockInfo.x, blockInfo.y, blockId);
        
        if (blockInfo.configData) {
            const btn = newBlock.querySelector('.configure-btn');
            btn.textContent = 'Configured';
            btn.classList.replace('btn-secondary', 'btn-success');
        }
        state.canvas.appendChild(newBlock);
    }

    // Re-attach event listeners to connection points for all loaded blocks
    modal.querySelectorAll('.workflow-block .connection-point').forEach(p => p.addEventListener('mousedown', startConnecting));

    state.connections = workflowData.connections || [];
    redrawConnections();
}

// --- BLOCK CREATION AND DRAGGING ---

function createWorkflowBlock(type, x, y, existingId = null) {
    const blockId = existingId || `block_${new Date().getTime()}`;
    const block = document.createElement('div');
    block.className = 'workflow-block';
    block.dataset.blockId = blockId;
    block.dataset.blockType = type;
    block.style.left = `${x}px`;
    block.style.top = `${y}px`;

    if (!existingId) {
        state.blocks[blockId] = { type, x, y, configData: null };
    }

    let title = '';
    let content = '';
    let connectionPoints = '<div class="connection-point input" data-point-id="in"></div>';

    switch (type) {
        case 'action':
            title = '<i class="fas fa-bolt"></i> Action';
            content = '<button class="btn btn-secondary btn-sm configure-btn">Configure</button>';
            connectionPoints += '<div class="connection-point output" data-point-id="out"></div>';
            break;
        case 'condition':
            title = '<i class="fas fa-code-branch"></i> Condition';
            content = '<button class="btn btn-secondary btn-sm configure-btn">Configure</button>';
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

function startDragBlock(e) {
    if (e.target.classList.contains('connection-point') || e.target.classList.contains('delete-block-btn')) return;
    e.preventDefault();
    e.stopPropagation();

    state.isDraggingBlock = true;
    state.draggedBlock = e.target.closest('.workflow-block');
    
    const rect = state.draggedBlock.getBoundingClientRect();
    state.offsetX = e.clientX - rect.left;
    state.offsetY = e.clientY - rect.top;

    document.addEventListener('mousemove', dragBlock);
    document.addEventListener('mouseup', stopDragBlock);
}

function dragBlock(e) {
    if (!state.isDraggingBlock || !state.draggedBlock) return;

    const canvasRect = state.canvas.getBoundingClientRect();
    let newX = e.clientX - canvasRect.left - state.offsetX;
    let newY = e.clientY - canvasRect.top - state.offsetY;

    newX = Math.round(newX / 10) * 10;
    newY = Math.round(newY / 10) * 10;

    const blockId = state.draggedBlock.dataset.blockId;
    state.draggedBlock.style.left = `${newX}px`;
    state.draggedBlock.style.top = `${newY}px`;

    state.blocks[blockId].x = newX;
    state.blocks[blockId].y = newY;

    updateBlockConnections(blockId);
}

function stopDragBlock() {
    state.isDraggingBlock = false;
    state.draggedBlock = null;
    document.removeEventListener('mousemove', dragBlock);
    document.removeEventListener('mouseup', stopDragBlock);
}

// --- CONNECTION LOGIC ---

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
    document.addEventListener('mouseup', endConnecting);
}

function drawTempConnector(e) {
    if (!state.isConnecting) return;
    const canvasRect = state.canvas.getBoundingClientRect();
    const endPos = {
        x: e.clientX - canvasRect.left,
        y: e.clientY - canvasRect.top,
    };
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
        }
    }

    state.isConnecting = false;
    state.startPoint = null;
    state.tempLine = null;
    document.removeEventListener('mousemove', drawTempConnector);
    document.removeEventListener('mouseup', endConnecting);
}


// --- INITIALIZATION ---

export function initializeWorkflowBuilder() {
    const modal = document.getElementById('hook-workflow-builder-modal');
    if (!modal) return;

    const openProjectHookBtn = document.getElementById('open-project-hook-builder-btn');
    const openTableHookBtn = document.getElementById('open-table-hook-builder-btn');
    const closeBtn = document.getElementById('hook-workflow-modal-close');
    const cancelBtn = document.getElementById('hook-workflow-modal-cancel');
    const doneBtn = document.getElementById('hook-workflow-modal-done');

    state.canvas = document.getElementById('workflow-canvas');
    state.canvasWrapper = state.canvas.parentElement;
    state.svg = document.getElementById('connector-svg');

    const openModal = (title, hookType) => {
        state.currentHookType = hookType;
        modal.querySelector('#hook-workflow-modal-title').textContent = title;
        
        let workflowJson;
        if (hookType === 'project') {
            workflowJson = jsonData.project.project_hook_workflow;
        } else {
            const tableName = document.querySelector('#table-settings-page .table-name')?.textContent;
            if (tableName && jsonData.database.table[tableName]) {
                workflowJson = jsonData.database.table[tableName].table_hook_workflow;
            }
        }

        try {
            const workflowData = JSON.parse(workflowJson);
            loadWorkflow(workflowData);
        } catch (e) {
            clearCanvas();
        }

        modal.classList.remove('hidden');
        modal.querySelectorAll('.connection-point').forEach(p => p.addEventListener('mousedown', startConnecting));
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        clearCanvas();
    };

    openProjectHookBtn?.addEventListener('click', () => openModal('Project Hook Workflow', 'project'));
    openTableHookBtn?.addEventListener('click', () => openModal('Table Hook Workflow', 'table'));
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    doneBtn?.addEventListener('click', () => {
        const workflowData = {
            blocks: state.blocks,
            connections: state.connections.map(c => ({ fromBlock: c.fromBlock, fromPoint: c.fromPoint, toBlock: c.toBlock, toPoint: c.toPoint }))
        };
        
        const workflowJson = JSON.stringify(workflowData, null, 2);

        const targetInputId = state.currentHookType === 'project' ? 'app-hook-logic' : 'tbl-hook-logic';
        const targetInput = document.getElementById(targetInputId);

        if(targetInput) {
            targetInput.value = workflowJson;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            console.error(`Target input not found: ${targetInputId}`);
        }

        closeModal();
    });

    const paletteItems = modal.querySelectorAll('.workflow-block-palette-item');
    paletteItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', e.target.dataset.blockType);
        });
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
    });

    // Event delegation for various block actions
    state.canvas.addEventListener('click', (e) => {
        if (e.target.classList.contains('configure-btn')) {
            const blockId = e.target.closest('.workflow-block').dataset.blockId;
            openBlockConfiguration(blockId);
        } else if (e.target.classList.contains('delete-block-btn')) {
            const blockId = e.target.closest('.workflow-block').dataset.blockId;
            deleteBlock(blockId);
        }
    });

    // Listener for deleting connections
    document.addEventListener('keydown', (e) => {
        if (modal.classList.contains('hidden')) return;
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelectedConnection();
        }
    });

    // Deselect connection when clicking on the canvas background
    state.canvas.addEventListener('mousedown', (e) => {
        if (e.target === state.canvas && state.selectedConnection) {
            state.selectedConnection.path.classList.remove('selected');
            state.selectedConnection = null;
        }
    });
}