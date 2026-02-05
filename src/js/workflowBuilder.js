// src/js/workflowBuilder.js

import { openModalLogicBuilder } from './uiHandlers.js';
import { appState } from './state.js';
import { resolveVariables } from './utils.js';
import { SaveManager } from './saveManager.js'; // ✅ Import yang betul (elak circular dependency)

/**
 * Fungsi teras yang boleh diguna semula untuk menyediakan satu instans workflow builder.
 */
function setupBuilderInstance(config) {
    const container = document.getElementById(config.containerId);
    if (!container) {
        console.error(`🔍 DEBUG_HOOK: Container ${config.containerId} tidak ditemui!`);
        return;
    }

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

    // --- FUNGSI SAVE STATE (TITIK A) ---
    const saveState = () => {
        const workflowData = {
            blocks: state.blocks,
            connections: state.connections.map(c => ({ fromBlock: c.fromBlock, fromPoint: c.fromPoint, toBlock: c.toBlock, toPoint: c.toPoint }))
        };
        const workflowJson = JSON.stringify(workflowData, null, 2);
        const targetInput = document.getElementById(config.hiddenInputId);

        if(targetInput) {
            // Log 1: Builder cuba simpan
            console.log(`🔍 DEBUG_HOOK: [Builder] Menyimpan state ke input #${config.hiddenInputId}`);
            
            targetInput.value = workflowJson;
            
            // Log 2: Dispatch event
            console.log(`🔍 DEBUG_HOOK: [Builder] Dispatching event 'change'...`);
            targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            console.error(`🔍 DEBUG_HOOK: [Critical] Input sasaran #${config.hiddenInputId} TIDAK DITEMUI!`);
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
            if (state.selectedConnection?.path) {
                state.selectedConnection.path.classList.remove('selected');
            }
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

    function rebuildBlock(blockId) {
        const blockEl = container.querySelector(`[data-block-id='${blockId}']`);
        const blockState = state.blocks[blockId];
        if (!blockEl || !blockState) return;
        
        const oldX = blockEl.style.left;
        const oldY = blockEl.style.top;
        
        const newBlockEl = createWorkflowBlock(blockState.type, 0, 0, blockId);
        
        blockEl.parentNode.replaceChild(newBlockEl, blockEl);
        
        newBlockEl.style.left = oldX;
        newBlockEl.style.top = oldY;
        
        redrawConnections();
    }
	
    function injectVariableHelpers(blockEl) {
        blockEl.querySelectorAll('input[type="text"], textarea').forEach(input => {
            if (input.classList.contains('variable-name-input')) return;
            if (input.nextElementSibling?.classList.contains('variable-helper-btn')) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'input-with-helper';
            
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);

            const button = document.createElement('button');
            button.className = 'variable-helper-btn';
            button.innerHTML = '<i class="fas fa-at"></i>';
            button.title = 'Insert variable';
            button.type = 'button';
            wrapper.appendChild(button);
        });
    }
	
    function generateCommentHTML(configData) {
        let comments = [];
        try {
            if (configData && configData.length > 2) {
                const config = JSON.parse(configData);
                comments = config
                    .filter(item => item.type === 'comment')
                    .map(item => item.value);
            }
        } catch (e) {}

        if (comments.length > 0) {
            return `<div class="block-comment-display">${comments.join('\n---\n')}</div>`;
        }
        return '';
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
                title = '<i class="fas fa-bolt"></i> Advanced Action';
                content = `
                    <button class="btn btn-secondary btn-sm configure-btn">Configure</button>
                    ${generateCommentHTML(blockState.configData)}
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out"></div>';
                break;
            case 'insert_record':
                title = '<i class="fas fa-plus-circle"></i> Insert Record';
                content = `
                    <button class="btn btn-secondary btn-sm configure-btn">Configure</button>
                    ${generateCommentHTML(blockState.configData)}
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out"></div>';
                break;
            case 'update_record':
                title = '<i class="fas fa-edit"></i> Update Record(s)';
                content = `
                    <button class="btn btn-secondary btn-sm configure-btn">Configure</button>
                    ${generateCommentHTML(blockState.configData)}
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out"></div>';
                break;
            case 'delete_record':
                title = '<i class="fas fa-trash-alt"></i> Delete Record(s)';
                content = `
                    <button class="btn btn-secondary btn-sm configure-btn">Configure</button>
                    ${generateCommentHTML(blockState.configData)}
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out"></div>';
                break;
            case 'condition':
                title = '<i class="fas fa-code-branch"></i> Condition';
                content = `
                    <button class="btn btn-secondary btn-sm configure-btn">Configure</button>
                    ${generateCommentHTML(blockState.configData)}
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in"></div>';
                connectionPoints += '<div class="connection-point output true" data-point-id="out-true" title="True"></div>';
                connectionPoints += '<div class="connection-point output false" data-point-id="out-false" title="False"></div>';
                break;
			case 'variable':
				const varName = blockState.variableName || '';
				const isConfigured = blockState.configData && blockState.configData !== '[]';
				const btnText = isConfigured ? 'Re-configure' : 'Configure';
				const btnClass = isConfigured ? 'btn-success' : 'btn-secondary';

				title = '<i class="fas fa-code"></i> Variable';
				content = `
					<input type="text" class="variable-name-input" placeholder="Variable Name..." value="${varName}">
					<button class="btn ${btnClass} btn-sm configure-btn">${btnText}</button>
					${generateCommentHTML(blockState.configData)}
				`;
				connectionPoints += '<div class="connection-point input" data-point-id="in"></div>';
				connectionPoints += '<div class="connection-point output" data-point-id="out"></div>';
				break;
			case 'for_each_loop': {
				const dataSource = blockState.dataSource || '##variable.my_list##';
				title = '<i class="fas fa-sync-alt"></i> For Each Loop';
				content = `
					<div class="form-group" style="margin-bottom:0;">
						<label style="font-size:0.8em; margin-bottom:0.25rem;">Loop through this list:</label>
						<input type="text" class="loop-data-source-input" placeholder="##variable.list_name##" value="${dataSource}">
					</div>
				`;
				connectionPoints += '<div class="connection-point input" data-point-id="in" data-label="In"></div>';
				connectionPoints += '<div class="connection-point output" data-point-id="out-body" data-label="Loop Body"></div>';
				connectionPoints += '<div class="connection-point output" data-point-id="out-complete" data-label="After Loop"></div>';
				break;
			}
            case 'data_transformer': {
                const state = blockState || {};
                const inputValue = state.inputValue || '';
                const selectedFunction = state.selectedFunction || 'format_date';
                const outputVariableName = state.outputVariableName || '';
                const dateFormat = state.parameters?.dateFormat || 'DD MMMM YYYY';
                const textOperation = state.parameters?.textOperation || 'uppercase';
                const mathExpression = state.parameters?.mathExpression || '##variable.harga## * 1.06';

                title = '<i class="fas fa-exchange-alt"></i> Data Transformer';
                content = `
                    <div class="transformer-content">
                        <div class="form-group">
                            <label>Input Value</label>
                            <input type="text" class="transformer-input" placeholder="##variable.nama##" value="${inputValue}">
                        </div>
                        <div class="form-group">
                            <label>Transformation</label>
                            <select class="transformer-function-select">
                                <option value="format_date" ${selectedFunction === 'format_date' ? 'selected' : ''}>Format Date</option>
                                <option value="text_operation" ${selectedFunction === 'text_operation' ? 'selected' : ''}>Text Operation</option>
                                <option value="math_operation" ${selectedFunction === 'math_operation' ? 'selected' : ''}>Math Operation</option>
                            </select>
                        </div>
                        <div class="transformer-params" data-param-for="format_date">
                            <div class="form-group">
                                <label>Date Format String</label>
                                <input type="text" class="transformer-param-date-format" placeholder="e.g., DD/MM/YYYY" value="${dateFormat}">
                            </div>
                        </div>
                        <div class="transformer-params" data-param-for="text_operation">
                            <div class="form-group">
                                <label>Operation</label>
                                <select class="transformer-param-text-op">
                                    <option value="uppercase" ${textOperation === 'uppercase' ? 'selected' : ''}>TO UPPERCASE</option>
                                    <option value="lowercase" ${textOperation === 'lowercase' ? 'selected' : ''}>To Lowercase</option>
                                </select>
                            </div>
                        </div>
                        <div class="transformer-params" data-param-for="math_operation">
                            <div class="form-group">
                                <label>Expression</label>
                                <input type="text" class="transformer-param-math-expr" value="${mathExpression}">
                            </div>
                        </div>
                        <hr style="margin: 0.25rem 0;">
                        <div class="form-group">
                            <label>Save Result as Variable</label>
                            <input type="text" class="transformer-output-name" placeholder="myFormattedData" value="${outputVariableName}">
                        </div>
                    </div>
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in" data-label="In"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out" data-label="Out"></div>';
                
                setTimeout(() => {
                    const blockEl = container.querySelector(`[data-block-id='${blockId}']`);
                    if(blockEl) {
                        const select = blockEl.querySelector('.transformer-function-select');
                        const params = blockEl.querySelectorAll('.transformer-params');
                        params.forEach(p => p.style.display = 'none');
                        blockEl.querySelector(`[data-param-for="${select.value}"]`).style.display = 'block';
                    }
                }, 0);
                break;
            }
            case 'terminate_workflow': {
                title = '<i class="fas fa-stop-circle"></i> Terminate Workflow';
                content = `
                    <p style="font-size: 0.9em; text-align: center; color: var(--secondary-color); margin:0;">
                        Workflow stops here with a 'Success' status.
                    </p>
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in" data-label="In"></div>';
                break;
            }
            case 'delay': {
                const state = blockState || {};
                const duration = state.delayDuration || 1;
                const unit = state.delayUnit || 'hours';

                title = '<i class="fas fa-hourglass-half"></i> Wait';
                content = `
                    <div class="delay-content">
                        <input type="number" class="delay-duration-input" min="1" value="${duration}">
                        <select class="delay-unit-select">
                            <option value="minutes" ${unit === 'minutes' ? 'selected' : ''}>Minutes</option>
                            <option value="hours" ${unit === 'hours' ? 'selected' : ''}>Hours</option>
                            <option value="days" ${unit === 'days' ? 'selected' : ''}>Days</option>
                        </select>
                    </div>
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in" data-label="In"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out" data-label="Out"></div>';
                break;
            }
            case 'try_catch': {
                title = '<i class="fas fa-shield-alt"></i> Try / Catch';
                content = `
                    <p style="font-size: 0.9em; text-align: center; color: var(--secondary-color); margin:0;">
                        Handles potential errors.
                    </p>
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in" data-label="In"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out-try" data-label="Try"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out-catch" data-label="Catch"></div>';
                break;
            }
            case 'send_email': {
                const state = blockState || {};
                title = '<i class="fas fa-paper-plane"></i> Send Email';
                content = `
                    <div class="email-form-container">
                        <div class="form-group"><label>To</label><input type="text" class="email-input" data-field="to" placeholder="##variable.user_email##" value="${state.to || ''}"></div>
                        <div class="form-group"><label>CC</label><input type="text" class="email-input" data-field="cc" placeholder="##variable.manager_email##" value="${state.cc || ''}"></div>
                        <div class="form-group"><label>BCC</label><input type="text" class="email-input" data-field="bcc" placeholder="archive@internal.com" value="${state.bcc || ''}"></div>
                        <div class="form-group"><label>Subject</label><input type="text" class="email-input" data-field="subject" placeholder="Order Confirmation ##variable.order_id##" value="${state.subject || ''}"></div>
                        <div class="form-group"><label>Body (HTML)</label><textarea class="email-input" data-field="body" rows="4" placeholder="Hello ##variable.user_name##,">${state.body || ''}</textarea></div>
                    </div>
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in" data-label="In"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out" data-label="Out"></div>';
                break;
            }
            case 'http_request': {
                const state = blockState || {};
                title = '<i class="fas fa-globe"></i> HTTP Request';
                const template = document.getElementById('http-request-template');
                const clone = template.content.cloneNode(true);
                clone.querySelector('.http-method-select').value = state.method || 'GET';
                clone.querySelector('.http-url-input').value = state.url || '';
                clone.querySelector('.http-body-textarea').value = state.body || '';
                clone.querySelector('.http-output-name').value = state.outputVariableName || '';
                
                const headersList = clone.querySelector('.http-headers-list');
                if (state.headers && state.headers.length > 0) {
                    const headerTemplate = document.getElementById('http-header-row-template');
                    state.headers.forEach(header => {
                        const headerClone = headerTemplate.content.cloneNode(true);
                        headerClone.querySelector('.http-header-key').value = header.key;
                        headerClone.querySelector('.http-header-value').value = header.value;
                        headersList.appendChild(headerClone);
                    });
                }
                const bodyGroup = clone.querySelector('.http-body-group');
                if (['POST', 'PUT', 'PATCH'].includes(state.method)) {
                    bodyGroup.style.display = 'block';
                }
                const tempDiv = document.createElement('div');
                tempDiv.appendChild(clone);
                content = tempDiv.innerHTML;
                connectionPoints += '<div class="connection-point input" data-point-id="in" data-label="In"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out" data-label="Out"></div>';
                break;
            }
            case 'switch': {
                const state = blockState || { cases: [{ value: 'Case 1' }] };
                title = '<i class="fas fa-sitemap"></i> Switch';
                let casesHTML = (state.cases || []).map((caseItem, index) => `
                    <div class="switch-case" data-case-index="${index}">
                        <input type="text" class="switch-case-value" placeholder="Value..." value="${caseItem.value}">
                        <button class="btn-sidebar-icon delete-case-btn" title="Delete Case">&times;</button>
                    </div>
                `).join('');

                content = `
                    <div class="switch-input-container">
                        <label>Switch on this value:</label>
                        <input type="text" class="switch-on-value" placeholder="##variable.status##" value="${state.switchValue || ''}">
                    </div>
                    <div class="switch-cases-list">${casesHTML}</div>
                    <div class="switch-actions">
                        <button class="btn btn-secondary btn-sm add-case-btn"><i class="fas fa-plus"></i> Add Case</button>
                    </div>
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in" data-label="In"></div>';
                (state.cases || []).forEach((caseItem, index) => {
                    const topPosition = 25 + (index * 20);
                    connectionPoints += `<div class="connection-point output" data-point-id="out-case-${index}" style="top: ${topPosition}%;"><span class="switch-case-label">${caseItem.value}</span></div>`;
                });
                const defaultTopPosition = 25 + ((state.cases?.length || 0) * 20);
                connectionPoints += `<div class="connection-point output" data-point-id="out-default" style="top: ${defaultTopPosition}%;"><span class="switch-case-label">Default</span></div>`;
                break;
            }
            case 'send_whatsapp': {
                const state = blockState || {};
                title = '<i class="fab fa-whatsapp"></i> Send WhatsApp';
                content = `
                    <div class="form-group" style="padding: 0.75rem;">
                        <label>To Phone Number</label>
                        <input type="text" class="whatsapp-input" data-field="to" placeholder="##variable.phone_no##" value="${state.to || ''}">
                        <label style="margin-top: 0.5rem;">Message</label>
                        <textarea class="whatsapp-input" data-field="message" rows="4" placeholder="Hello ##variable.user_name##...">${state.message || ''}</textarea>
                    </div>
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in" data-label="In"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out" data-label="Out"></div>';
                break;
            }
            case 'send_telegram': {
                const state = blockState || {};
                title = '<i class="fab fa-telegram-plane"></i> Send Telegram';
                content = `
                    <div class="form-group" style="padding: 0.75rem;">
                        <label>To Chat ID</label>
                        <input type="text" class="telegram-input" data-field="chat_id" placeholder="##variable.telegram_chat_id##" value="${state.chat_id || ''}">
                        <label style="margin-top: 0.5rem;">Message</label>
                        <textarea class="telegram-input" data-field="message" rows="4" placeholder="Hello ##variable.user_name##...">${state.message || ''}</textarea>
                    </div>
                `;
                connectionPoints += '<div class="connection-point input" data-point-id="in" data-label="In"></div>';
                connectionPoints += '<div class="connection-point output" data-point-id="out" data-label="Out"></div>';
                break;
            }
        }

        block.innerHTML = `
            <button class="delete-block-btn" title="Delete Block">&times;</button>
            <div class="workflow-block-title">${title}</div>
            <div class="workflow-block-content">${content}</div>
            <div class="connection-point-container">${connectionPoints}</div>
        `;

        block.querySelector('.workflow-block-title').addEventListener('mousedown', startDragBlock);
        block.querySelectorAll('.connection-point').forEach(p => p.addEventListener('mousedown', startConnecting));

		injectVariableHelpers(block);
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
        
        const blockData = state.blocks[blockId];
        if (!blockData) return;

        let tempInput = document.getElementById('workflow-temp-input');
        if (!tempInput) {
            tempInput = document.createElement('input');
            tempInput.type = 'hidden'; tempInput.id = 'workflow-temp-input';
            document.body.appendChild(tempInput);
        }
        tempInput.value = blockData.configData || '[]';

        const VALUE_CALCULATOR_GRAMMAR = {
            'start':               ['value', 'open_paren', 'if', 'comment'],
            'value':               ['comparison_operator', 'arithmetic_operator', 'logical_operator', 'then', 'else', 'else_if', 'close_paren', 'comment'],
            'comparison_operator': ['value', 'open_paren', 'comment'],
            'arithmetic_operator': ['value', 'open_paren', 'comment'],
            'logical_operator':    ['value', 'open_paren', 'if', 'comment'],
            'if':                  ['value', 'open_paren', 'comment'],
            'else_if':             ['value', 'open_paren', 'comment'],
            'then':                ['value', 'open_paren', 'comment'],
            'else':                ['value', 'open_paren', 'comment'],
            'open_paren':          ['value', 'open_paren', 'if', 'comment'],
            'close_paren':         ['comparison_operator', 'arithmetic_operator', 'logical_operator', 'then', 'else', 'else_if', 'close_paren', 'comment'],
        };

        const ACTION_SCRIPT_GRAMMAR = {
            'start':               ['insert_record', 'update_record', 'delete_record', 'custom_query', 'comment'],
            'insert_record':       ['insert_record', 'update_record', 'delete_record', 'custom_query', 'comment'],
            'update_record':       ['insert_record', 'update_record', 'delete_record', 'custom_query', 'comment'],
            'delete_record':       ['insert_record', 'update_record', 'delete_record', 'custom_query', 'comment'],
            'custom_query':        ['insert_record', 'update_record', 'delete_record', 'custom_query', 'comment'],
        };
        
        let validationRules = {};
        let allowedComponents = [];
        const hookType = config.hookType;

        const allValueComponents = ['if', 'else_if', 'then', 'else', 'comparison_operator', 'logical_operator', 'arithmetic_operator', 'this_record_data', 'calculate_related_record', 'related_record_data', 'lookup_value', 'custom_query', 'api_endpoint', 'current_user', 'current_datetime', 'string', 'number', 'boolean', 'null', 'open_paren', 'close_paren', 'comment'];
        const allActionComponents = ['custom_query', 'insert_record', 'update_record', 'delete_record', 'comment'];

        switch (blockType) {
            case 'action':
                allowedComponents = allActionComponents;
                validationRules = ACTION_SCRIPT_GRAMMAR;
                break;
            case 'insert_record':
                allowedComponents = ['insert_record', 'comment'];
                validationRules = ACTION_SCRIPT_GRAMMAR;
                break;
            case 'update_record':
                allowedComponents = ['update_record', 'comment'];
                validationRules = ACTION_SCRIPT_GRAMMAR;
                break;
            case 'delete_record':
                allowedComponents = ['delete_record', 'comment'];
                validationRules = ACTION_SCRIPT_GRAMMAR;
                break;
            case 'condition':
            case 'variable':
                allowedComponents = allValueComponents;
                validationRules = VALUE_CALCULATOR_GRAMMAR;
                break;
        }

        if (hookType === 'project' && (blockType === 'condition' || blockType === 'variable')) {
            const recordSpecificComponents = ['this_record_data', 'calculate_related_record', 'related_record_data'];
            allowedComponents = allowedComponents.filter(comp => !recordSpecificComponents.includes(comp));
        }

        const userDefinedVars = Object.values(state.blocks)
            .filter(b => b.type === 'variable' && b.variableName)
            .map(b => b.variableName);
            
        const blocksWithLegend = ['action', 'insert_record', 'update_record', 'delete_record', 'condition', 'variable'];
        const shouldShowLegend = blocksWithLegend.includes(blockType);

        openModalLogicBuilder({
            allowedComponents: allowedComponents,
            modalId: 'algorithm-builder-modal',
            getContext: () => ({ tableName: config.hookType === 'table' ? document.querySelector('#table-settings-page .table-name')?.textContent : null }),
            closeButtonId: 'algorithm-builder-close',
            cancelButtonId: 'algorithm-builder-cancel-btn',
            doneButtonId: 'algorithm-builder-done-btn',
            targetInputId: 'workflow-temp-input',
            validationRules: validationRules,
            availableVariables: userDefinedVars,
            showVariableLegend: shouldShowLegend,
            onComplete: (logicJson) => {
                state.blocks[blockId].configData = logicJson;
                saveState();
                rebuildBlock(blockId);
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
        const block = e.target.closest('.workflow-block');
        const button = e.target.closest('button');

        if (button && button.classList.contains('variable-helper-btn')) {
            e.preventDefault();
            const targetInput = button.previousElementSibling;
            const menu = document.getElementById('variable-helper-menu');
            
            const defaultVars = ['ID', 'USERNAME', 'GROUPID', 'GROUP', 'NOW'];
            const userDefinedVars = Object.values(state.blocks)
                .filter(b => b.type === 'variable' && b.variableName)
                .map(b => b.variableName);

            const defaultGroup = menu.querySelector('[data-group-type="default"]');
            const userGroup = menu.querySelector('[data-group-type="user"]');
            
            defaultGroup.querySelectorAll('.variable-helper-item').forEach(it => it.remove());
            userGroup.querySelectorAll('.variable-helper-item').forEach(it => it.remove());

            defaultVars.forEach(v => {
                const item = document.createElement('div');
                item.className = 'variable-helper-item';
                item.textContent = `##${v}##`;
                item.onclick = () => insertVariable(targetInput, `##${v}##`);
                defaultGroup.appendChild(item);
            });

            if (userDefinedVars.length > 0) {
                userGroup.style.display = 'block';
                userDefinedVars.forEach(v => {
                    const item = document.createElement('div');
                    item.className = 'variable-helper-item';
                    item.textContent = `##variable.${v}##`;
                    item.onclick = () => insertVariable(targetInput, `##variable.${v}##`);
                    userGroup.appendChild(item);
                });
            } else {
                userGroup.style.display = 'none';
            }

            const btnRect = button.getBoundingClientRect();
            menu.style.display = 'block';
            menu.style.top = `${btnRect.bottom + window.scrollY}px`;
            menu.style.left = `${btnRect.right + window.scrollX - menu.offsetWidth}px`;

            setTimeout(() => {
                document.addEventListener('click', function closeMenu(event) {
                    if (!menu.contains(event.target)) {
                        menu.style.display = 'none';
                        document.removeEventListener('click', closeMenu);
                    }
                }, { once: true });
            }, 0);
            return;
        }

        if (!block) return;
        const blockId = block.dataset.blockId;
        const blockState = state.blocks[blockId];

        if (e.target.matches('.delete-block-btn, .delete-block-btn *')) {
            deleteBlock(blockId);
        }
        else if (e.target.matches('.configure-btn, .configure-btn *')) {
            openBlockConfiguration(blockId);
        }
        else if (e.target.matches('.http-add-header-btn, .http-add-header-btn *')) {
            const list = block.querySelector('.http-headers-list');
            const template = document.getElementById('http-header-row-template');
            list.appendChild(template.content.cloneNode(true));
        }
        else if (e.target.matches('.http-delete-header-btn, .http-delete-header-btn *')) {
            e.target.closest('.http-header-row').remove();
            saveState();
        }
        else if (e.target.matches('.add-case-btn, .add-case-btn *')) {
            if (!blockState.cases) blockState.cases = [];
            blockState.cases.push({ value: `Case ${blockState.cases.length + 1}` });
            rebuildBlock(blockId);
            saveState();
        }
        else if (e.target.matches('.delete-case-btn, .delete-case-btn *')) {
            const caseIndex = parseInt(e.target.closest('.switch-case').dataset.caseIndex, 10);
            if (blockState?.cases) {
                blockState.cases.splice(caseIndex, 1);
                rebuildBlock(blockId);
                saveState();
            }
        }
        else if (e.target.matches('.add-field-btn, .add-field-btn *')) {
            if (!blockState.details) blockState.details = { values: [], set: [] };
            const listType = blockState.type === 'insert_record' ? 'values' : 'set';
            if (!blockState.details[listType]) blockState.details[listType] = [];
            blockState.details[listType].push({ field: '', value: '' });
            rebuildBlock(blockId);
            saveState();
        }
        else if (e.target.matches('.delete-pair-btn, .delete-pair-btn *')) {
            const listType = blockState.type === 'insert_record' ? 'values' : 'set';
            const index = e.target.closest('.field-value-pair').dataset.index;
            blockState.details[listType].splice(index, 1);
            rebuildBlock(blockId);
            saveState();
        }
        else if (e.target.matches('.add-where-rule-btn, .add-where-rule-btn *')) {
            if (!blockState.details) blockState.details = {};
            if (!blockState.details.where) blockState.details.where = { logic: 'AND', rules: [] };
            blockState.details.where.rules.push({ field: '', operator: '=', value: '' });
            rebuildBlock(blockId);
            saveState();
        }
        else if (e.target.matches('.delete-where-rule-btn, .delete-where-rule-btn *')) {
            const index = e.target.closest('.cqb-rule').dataset.index;
            blockState.details.where.rules.splice(index, 1);
            rebuildBlock(blockId);
            saveState();
        }
    });

    state.canvas.addEventListener('input', (e) => {
        const block = e.target.closest('.workflow-block');
        if (!block) return;
        const blockId = block.dataset.blockId;
        const blockState = state.blocks[blockId];
        if (!blockState) return;

        const fieldMap = {
            'variable-name-input': 'variableName',
            'loop-data-source-input': 'dataSource',
            'delay-duration-input': 'delayDuration',
            'transformer-input': 'inputValue',
            'transformer-output-name': 'outputVariableName',
            'http-url-input': 'url',
            'http-body-textarea': 'body',
            'http-output-name': 'outputVariableName',
            'switch-on-value': 'switchValue'
        };

        for (const [cssClass, stateKey] of Object.entries(fieldMap)) {
            if (e.target.classList.contains(cssClass)) {
                blockState[stateKey] = e.target.value;
                saveState();
                return;
            }
        }
        
        if (e.target.matches('.transformer-params input, .transformer-params select')) {
            if (!blockState.parameters) blockState.parameters = {};
            if(e.target.classList.contains('transformer-param-date-format')) blockState.parameters.dateFormat = e.target.value;
            if(e.target.classList.contains('transformer-param-text-op')) blockState.parameters.textOperation = e.target.value;
            if(e.target.classList.contains('transformer-param-math-expr')) blockState.parameters.mathExpression = e.target.value;
        } else if (e.target.matches('.http-header-key, .http-header-value')) {
            const headers = Array.from(block.querySelectorAll('.http-header-row')).map(row => ({
                key: row.querySelector('.http-header-key').value,
                value: row.querySelector('.http-header-value').value
            }));
            blockState.headers = headers;
        } else if (e.target.matches('.switch-case-value')) {
            const caseIndex = parseInt(e.target.closest('.switch-case').dataset.caseIndex, 10);
            if (blockState.cases && blockState.cases[caseIndex]) {
                blockState.cases[caseIndex].value = e.target.value;
                rebuildBlock(blockId);
            }
        } 
        else if (e.target.classList.contains('email-input')) {
            const field = e.target.dataset.field;
            if (field) blockState[field] = e.target.value;
        } else if (e.target.classList.contains('whatsapp-input')) {
            const field = e.target.dataset.field;
            if (field) blockState[field] = e.target.value;
        } else if (e.target.classList.contains('telegram-input')) {
            const field = e.target.dataset.field;
            if (field) blockState[field] = e.target.value;
        }

        saveState();
    });
	
    state.canvas.addEventListener('change', (e) => {
        const block = e.target.closest('.workflow-block');
        if (!block) return;
        const blockId = block.dataset.blockId;
        const blockState = state.blocks[blockId];
        if (!blockState) return;
        
        const fieldMap = {
            'delay-unit-select': 'delayUnit',
            'transformer-function-select': 'selectedFunction'
        };

        for (const [cssClass, stateKey] of Object.entries(fieldMap)) {
            if (e.target.classList.contains(cssClass)) {
                blockState[stateKey] = e.target.value;
                if (cssClass === 'transformer-function-select') {
                    block.querySelectorAll('.transformer-params').forEach(p => p.style.display = 'none');
                    block.querySelector(`[data-param-for="${e.target.value}"]`).style.display = 'block';
                }
                saveState();
                return;
            }
        }

        if (e.target.classList.contains('http-method-select')) {
            blockState.method = e.target.value;
            const bodyGroup = block.querySelector('.http-body-group');
            if (['POST', 'PUT', 'PATCH'].includes(e.target.value)) {
                bodyGroup.style.display = 'block';
            } else {
                bodyGroup.style.display = 'none';
            }
            saveState();
        }
    });

    const insertVariable = (input, value) => {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.substring(0, start) + value + input.value.substring(end);
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('variable-helper-menu').style.display = 'none';
    };
    
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
    } catch (e) { 
        console.warn(`🔍 DEBUG_HOOK: Gagal memuatkan workflow state untuk ${config.containerId}:`, e);
        state.blocks = {};
        state.connections = [];
    }

    const observer = new ResizeObserver(() => {
        if (state.canvas.offsetWidth > 0 && state.canvas.offsetHeight > 0) {
            redrawConnections();
            observer.disconnect();
        }
    });
    observer.observe(state.canvas);
}

/**
 * Fungsi utama untuk memulakan kedua-dua workflow builder.
 */
export function initializeWorkflowBuilder() {
    // 1. Setup untuk Project Hook
    setupBuilderInstance({
        containerId: 'project-workflow-container',
        hiddenInputId: 'app-hook-logic',
        hookType: 'project'
    });

    // --- PEMBAIKAN MUKTAMAD: PROJECT HOOK AUTO-SAVE ---
    const projectHookInput = document.getElementById('app-hook-logic');
    if (projectHookInput) {
        // Buang listener lama (jika ada) dengan cloneNode
        const newInput = projectHookInput.cloneNode(true);
        projectHookInput.parentNode.replaceChild(newInput, projectHookInput);
        
        newInput.addEventListener('change', () => {
            if (appState.activeProject?.project_id) {
                // Gunakan nama lajur yang telah disahkan melalui log debug tadi
                const payloadKey = 'project_hook_workflow'; 
                
                console.log(`💾 Auto-Saving Project Hook (Column: ${payloadKey})...`);
                
                SaveManager.addToQueue('project', appState.activeProject.project_id, {
                    [payloadKey]: newInput.value
                });
            }
        });
    }
    // --------------------------------------------------

    // 2. Setup untuk Table Hook (Melalui Observer)
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