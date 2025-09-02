/**
 * Membuka Query Builder dalam mod 'general'.
 * Fungsi ini boleh dieksport dan dipanggil dari mana-mana, terutamanya dari Algorithm Builder.
 */
export function openGeneralQueryBuilder(targetTextarea) {
    let tableName;
    const fieldPage = document.getElementById('field-settings-page');
    const tablePage = document.getElementById('table-settings-page');

    // Tentukan konteks jadual berdasarkan halaman yang sedang aktif
    if (fieldPage && !fieldPage.classList.contains('hidden')) {
        [tableName] = fieldPage.querySelector('.field-name')?.textContent.split('.') || [];
    } else if (tablePage && !tablePage.classList.contains('hidden')) {
        tableName = tablePage.querySelector('.table-name')?.textContent;
    }

    if (!tableName) {
        showCustomDialog({ title: "Error", message: "Please select a table or a field first to open the Query Builder." });
        return;
    }

    let initialState = null;
    if (targetTextarea) {
        const stateInput = targetTextarea.parentElement.querySelector('.query-builder-state');
        if (stateInput) {
            initialState = stateInput.value || null;
        }
    }

    showConfigurableQueryBuilder({
        mode: 'general',
        tableName: tableName,
        initialState: initialState,
        onComplete: (sql, state) => {
            if (targetTextarea) {
                targetTextarea.value = sql;
                const stateInput = targetTextarea.parentElement.querySelector('.query-builder-state');
                if (stateInput) stateInput.value = state;
                targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });
}

/**
 * Fungsi Teras Boleh Guna Semula untuk mencipta Logic Builder.
 * Ia menerima satu objek konfigurasi untuk menentukan kelakuannya.
 * @param {object} config - Objek konfigurasi.
 * @param {HTMLElement} config.palette - Elemen palet.
 * @param {HTMLElement} config.canvas - Elemen kanvas.
 * @param {HTMLInputElement} config.hiddenInput - Elemen input tersembunyi.
 * @param {object} config.validationRules - Tatabahasa (grammar) untuk pengesahan susunan.
 * @param {object} [config.context] - Objek pilihan untuk membekalkan data konteks (cth: { tableName: 'users' }).
 * @param {string} [config.updateMode='live'] - Mod kemas kini ('live' atau 'manual').
 * @returns {object} Objek dengan kaedah untuk berinteraksi dengan builder.
 */
// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

function setupLogicBuilderCore(config) {
    const { palette, canvas, hiddenInput, validationRules, context, updateMode = 'live' } = config;
    const placeholder = canvas ? canvas.querySelector('.canvas-placeholder') : null;

    if (!palette || !canvas || !hiddenInput) {
        console.error("Satu atau lebih elemen untuk Logic Builder tidak ditemui.", { palette: !!palette, canvas: !!canvas, hiddenInput: !!hiddenInput });
        return;
    }

    let modalCanvasState = '[]';

    // ▼▼▼ MULA FUNGSI BAHARU: UNTUK MODAL LOOKUP CONDITION ▼▼▼
    const openLookupConditionModal = (componentEl) => {
        const modal = document.getElementById('lookup-condition-modal');
        if (!modal) return;

        const elements = {
            externalFieldSelect: document.getElementById('lookup-cond-external-field'),
            operatorSelect: document.getElementById('lookup-cond-operator'),
            valueTypeSelect: document.getElementById('lookup-cond-value-type'),
            staticValueGroup: document.getElementById('lookup-cond-static-value-group'),
            staticValueInput: document.getElementById('lookup-cond-static-value'),
            dynamicValueGroup: document.getElementById('lookup-cond-dynamic-value-group'),
            dynamicValueSelect: document.getElementById('lookup-cond-dynamic-value'),
            okBtn: document.getElementById('lookup-condition-ok'),
            cancelBtn: document.getElementById('lookup-condition-cancel'),
            closeBtn: document.getElementById('lookup-condition-close')
        };

        // 1. Dapatkan konteks
        const externalTableName = componentEl.querySelector('.table-select').value;
        const currentTableName = context.tableName;

        // 2. Isi dropdown
        elements.externalFieldSelect.innerHTML = '';
        Object.keys(jsonData.database.table[externalTableName].fields).forEach(f => {
            const option = document.createElement('option');
            option.value = f;
            option.textContent = f;
            elements.externalFieldSelect.appendChild(option);
        });

        elements.dynamicValueSelect.innerHTML = '';
        Object.keys(jsonData.database.table[currentTableName].fields).forEach(f => {
            const option = document.createElement('option');
            option.value = `##current_record.${f}##`;
            option.textContent = f;
            elements.dynamicValueSelect.appendChild(option);
        });

        // 3. Muatkan keadaan sedia ada dari dataset komponen
        const cond = componentEl.dataset;
        elements.externalFieldSelect.value = cond.condField || '';
        elements.operatorSelect.value = cond.condOperator || '=';
        elements.valueTypeSelect.value = cond.condValueType || 'dynamic';
        if (cond.condValueType === 'static') {
            elements.staticValueInput.value = cond.condValue || '';
        } else {
            elements.dynamicValueSelect.value = cond.condValue || '';
        }

        // 4. Uruskan kebolehlihatan input nilai
        const toggleValueInputs = () => {
            const isStatic = elements.valueTypeSelect.value === 'static';
            elements.staticValueGroup.classList.toggle('hidden', !isStatic);
            elements.dynamicValueGroup.classList.toggle('hidden', isStatic);
        };
        elements.valueTypeSelect.addEventListener('change', toggleValueInputs);
        toggleValueInputs();

        // 5. Pasang event listener butang
        const closeModal = () => modal.classList.add('hidden');
        
        const newOkBtn = elements.okBtn.cloneNode(true);
        elements.okBtn.parentNode.replaceChild(newOkBtn, elements.okBtn);
        
        newOkBtn.addEventListener('click', () => {
            const isStatic = elements.valueTypeSelect.value === 'static';
            componentEl.dataset.condField = elements.externalFieldSelect.value;
            componentEl.dataset.condOperator = elements.operatorSelect.value;
            componentEl.dataset.condValueType = elements.valueTypeSelect.value;
            componentEl.dataset.condValue = isStatic ? elements.staticValueInput.value : elements.dynamicValueSelect.value;
            
            // Tandakan butang sebagai "dikonfigurasi"
            const configBtn = componentEl.querySelector('.config-lookup-btn');
            if(configBtn) configBtn.classList.add('configured');

            updateModalCanvasState(); // Simpan keadaan baharu
            closeModal();
        });

        elements.cancelBtn.addEventListener('click', closeModal);
        elements.closeBtn.addEventListener('click', closeModal);

        // 6. Paparkan modal
        modal.classList.remove('hidden');
    };
    // ▲▲▲ TAMAT FUNGSI BAHARU ▲▲▲

    const handleWrapWithFunction = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const originalItem = e.target.closest('.dropped-item');
        if (!originalItem) return;
        showCustomDialog({
            title: "Wrap with Function",
            message: "Do you want to wrap this component with a built-in function?",
            showCancelButton: true,
            onOk: () => {
                const originalParent = originalItem.parentElement;
                const functionData = { type: 'function' };
                const functionWrapper = createInteractiveElement(functionData);
                const argZone = functionWrapper.querySelector('.function-argument-droppable');
                if (!argZone) {
                    console.error("Argument drop zone not found in function wrapper.");
                    return;
                }
                originalParent.replaceChild(functionWrapper, originalItem);
                argZone.innerHTML = '';
                argZone.appendChild(originalItem);
                updateModalCanvasState();
            }
        });
    };

    const updateModalCanvasState = () => {
        const mapItems = (container) => {
            const children = Array.from(container.children).filter(el => el.classList.contains('dropped-item'));
            return children.map(item => {
                const type = item.dataset.itemType;
                let itemData = { type };

                if (type === 'function') {
                    itemData.name = item.dataset.functionName;
                    const argContainer = item.querySelector('.function-argument-droppable');
                    itemData.arguments = mapItems(argContainer);
                } else if (type === 'comment') {
                    itemData.value = item.querySelector('textarea')?.value;
                } else if (type === 'field' || type === 'external_table_field') {
                    itemData.table = item.querySelector('.table-select')?.value;
                    itemData.field = item.querySelector('.field-select')?.value;
                    
                    // ▼▼▼ BACA DATA SYARAT DARI DATASET ▼▼▼
                    if (type === 'external_table_field' && item.dataset.condField) {
                        itemData.condition = {
                            field: item.dataset.condField,
                            operator: item.dataset.condOperator,
                            valueType: item.dataset.condValueType,
                            value: item.dataset.condValue
                        };
                    }
                    // ▲▲▲ TAMAT BACAAN DATA ▲▲▲

                } else if (type === 'this_table_field') {
                    itemData.field = item.querySelector('.field-select')?.value;
                } else if (type === 'boolean') {
                    itemData.value = item.querySelector('select')?.value;
                } else if (['comparison_operator', 'logical_operator', 'arithmetic_operator', 'current_user', 'current_datetime'].includes(type)) {
                    itemData.value = item.querySelector('.operator-select')?.value;
                } else if (['string', 'number', 'api_endpoint'].includes(type)) {
                    itemData.value = item.querySelector('input')?.value;
                } else if (type === 'sql_query') {
                    itemData.value = item.querySelector('textarea')?.value || '';
                    const stateInput = item.querySelector('.query-builder-state');
                    if (stateInput && stateInput.value) {
                        itemData.builder_state = stateInput.value;
                    }
                } else {
                    const valueSpan = item.querySelector('span:not(.paren)');
                    itemData.value = valueSpan ? valueSpan.textContent : type;
                }
                return itemData;
            });
        };

        const logicArray = mapItems(canvas);
        modalCanvasState = JSON.stringify(logicArray, null, 2);
        if (placeholder) placeholder.style.display = logicArray.length === 0 ? 'block' : 'none';

        if (updateMode === 'live') {
            hiddenInput.value = modalCanvasState;
            hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };
    
    const populateCanvasFromHiddenInput = () => {
        const buildFromLogic = (container, logicArray) => {
            container.innerHTML = '';
            if (logicArray.length === 0 && container.classList.contains('algorithm-canvas')) {
                 if (placeholder) container.appendChild(placeholder);
            } else if (logicArray.length === 0 && container.classList.contains('function-argument-droppable')) {
                container.innerHTML = '<span class="canvas-placeholder">Drop value here</span>';
            }

            logicArray.forEach(itemData => {
                const newItem = createInteractiveElement(itemData);
                container.appendChild(newItem);

                if (['field', 'external_table_field'].includes(itemData.type)) {
                    newItem.querySelector('.table-select').value = itemData.table;
                    newItem.querySelector('.table-select').dispatchEvent(new Event('change'));
                    newItem.querySelector('.field-select').value = itemData.field;

                    // ▼▼▼ SIMPAN SYARAT KE DATASET & GAYAKAN BUTANG ▼▼▼
                    if (itemData.type === 'external_table_field' && itemData.condition) {
                        newItem.dataset.condField = itemData.condition.field;
                        newItem.dataset.condOperator = itemData.condition.operator;
                        newItem.dataset.condValueType = itemData.condition.valueType;
                        newItem.dataset.condValue = itemData.condition.value;
                        const configBtn = newItem.querySelector('.config-lookup-btn');
                        if (configBtn) configBtn.classList.add('configured');
                    }
                    // ▲▲▲ TAMAT SIMPANAN DATA ▲▲▲

                } else if (itemData.type === 'comment') {
                    newItem.querySelector('textarea').value = itemData.value;
                } else if (itemData.type === 'this_table_field') {
                    newItem.querySelector('.field-select').value = itemData.field;
                } else if (itemData.type === 'boolean' || ['comparison_operator', 'logical_operator', 'arithmetic_operator', 'current_user', 'current_datetime'].includes(itemData.type)) {
                    newItem.querySelector('select').value = itemData.value;
                } else if (['string', 'number', 'api_endpoint'].includes(itemData.type)) {
                    newItem.querySelector('input').value = itemData.value;
                } else if (itemData.type === 'sql_query') {
                    newItem.querySelector('textarea').value = itemData.value || '';
                    const stateInput = newItem.querySelector('.query-builder-state');
                    if (stateInput && itemData.builder_state) {
                        stateInput.value = itemData.builder_state;
                    }
                }

                if (itemData.type === 'function' && itemData.arguments) {
                    const argContainer = newItem.querySelector('.function-argument-droppable');
                    buildFromLogic(argContainer, itemData.arguments);
                }
            });
        };

        const currentLogicValue = hiddenInput.value || '[]';
        const logic = JSON.parse(currentLogicValue);
        buildFromLogic(canvas, logic);
    };

    // ... (rest of the functions like isValidDrop, etc. remain the same) ...
    // The following code is truncated for brevity but should be the same as your original file
    
    // (Ensure the rest of the original function from createInteractiveElement to the return statement is here)
    const createInteractiveElement = (data) => {
        const type = data.type;
        const itemContainer = document.createElement('div');
        itemContainer.className = 'dropped-item';
        itemContainer.dataset.itemType = type;
        const VALUE_TYPES_FOR_WRAPPING = ['field', 'this_table_field', 'external_table_field', 'string', 'number', 'sql_query', 'api_endpoint', 'boolean', 'null', 'current_user', 'current_datetime'];
        if (VALUE_TYPES_FOR_WRAPPING.includes(type)) {
            const fxButton = document.createElement('button');
            fxButton.className = 'wrap-function-btn';
            fxButton.innerHTML = 'fx';
            fxButton.title = 'Wrap with a function';
            fxButton.addEventListener('click', handleWrapWithFunction);
            itemContainer.appendChild(fxButton);
        }
        switch (type) {
            case 'comment': {
                const commentHeader = document.createElement('div');
                commentHeader.className = 'comment-header';
                commentHeader.innerHTML = `<i class="fas fa-info-circle"></i> <span>For notes only. Not included in logic.</span>`;
                const textarea = document.createElement('textarea');
                textarea.placeholder = "Type your comment here...";
                textarea.addEventListener('input', updateModalCanvasState);
                itemContainer.appendChild(commentHeader);
                itemContainer.appendChild(textarea);
                itemContainer.classList.add('comment-item');
                break;
            }
            case 'function': {
                itemContainer.dataset.functionName = data.name || 'CONCAT';
                const functionSelect = document.createElement('select');
                functionSelect.className = 'function-select';
                const functions = ['CONCAT', 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'UPPER', 'LOWER', 'LENGTH', 'ROUND', 'DATE_FORMAT'];
                functions.forEach(func => {
                    const option = document.createElement('option');
                    option.value = func;
                    option.textContent = func;
                    if (func === (data.name || 'CONCAT')) option.selected = true;
                    functionSelect.appendChild(option);
                });
                functionSelect.addEventListener('change', (e) => {
                    itemContainer.dataset.functionName = e.target.value;
                    updateModalCanvasState();
                });
                const openParen = document.createElement('span');
                openParen.textContent = '(';
                openParen.className = 'paren';
                const argContainer = document.createElement('div');
                argContainer.className = 'function-argument-droppable';
                argContainer.innerHTML = '<span class="canvas-placeholder">Drop arguments here</span>';
                const closeParen = document.createElement('span');
                closeParen.textContent = ')';
                closeParen.className = 'paren';
                itemContainer.appendChild(functionSelect);
                itemContainer.appendChild(openParen);
                itemContainer.appendChild(argContainer);
                itemContainer.appendChild(closeParen);
                break;
            }
            // (The rest of the swit            
            case 'sql_query':
                itemContainer.innerHTML = `<div class="sql-query-header"><span>[SQL QUERY]</span><button class="open-qb-btn" title="Open Query Builder"><i class="fas fa-magic-wand-sparkles"></i></button></div><textarea placeholder="SELECT * FROM ..."></textarea><input type="hidden" class="query-builder-state">`;
                itemContainer.querySelector('textarea').addEventListener('input', updateModalCanvasState);
                itemContainer.querySelector('.open-qb-btn').addEventListener('click', (e) => {
                    openGeneralQueryBuilder(e.target.closest('.dropped-item').querySelector('textarea'));
                });
                break;
            case 'api_endpoint':
                itemContainer.innerHTML = `<span class="api-endpoint-label">[API ENDPOINT]</span><input type="text" placeholder="https://api.example.com/data">`;
                itemContainer.querySelector('input').addEventListener('input', updateModalCanvasState);
                break;            
                case 'external_table_field': {
                const activeTable = config.context?.tableName || '';
                const tableSelect = document.createElement('select');
                tableSelect.className = 'table-select';
                const allOtherTables = Object.keys(jsonData.database.table).filter(t => t !== activeTable);
                allOtherTables.forEach(tableName => {
                    const option = document.createElement('option');
                    option.value = tableName;
                    option.textContent = tableName;
                    tableSelect.appendChild(option);
                });
                itemContainer.appendChild(tableSelect);
                const fieldSelect = document.createElement('select');
                fieldSelect.className = 'field-select';
                const populateFields = (tableName) => {
                    fieldSelect.innerHTML = '';
                    if (jsonData.database.table[tableName]) {
                        const fields = Object.keys(jsonData.database.table[tableName].fields);
                        fields.forEach(fieldName => {
                            const option = document.createElement('option');
                            option.value = fieldName;
                            option.textContent = fieldName;
                            fieldSelect.appendChild(option);
                        });
                    }
                };
                tableSelect.addEventListener('change', () => {
                    populateFields(tableSelect.value);
                    updateModalCanvasState();
                });
                fieldSelect.addEventListener('change', updateModalCanvasState);
                itemContainer.appendChild(fieldSelect);
                if (allOtherTables.length > 0) {
                     populateFields(allOtherTables[0]);
                }
                const configBtn = document.createElement('button');
                configBtn.className = 'btn-sidebar-icon config-lookup-btn';
                configBtn.title = 'Set Lookup Condition';
                configBtn.innerHTML = '<i class="fas fa-cog"></i>';
                itemContainer.appendChild(configBtn);
                // ▲▲▲ TAMAT KOD BAHARU ▲▲▲
                
                break;
            }
            case 'this_table_field': {
                let activeTable = '';
                if (context && context.tableName) {
                    activeTable = context.tableName;
                } else {
                    console.warn("Konteks jadual tidak ditemui untuk komponen 'This Table.Field'");
                }

                const tableInput = document.createElement('input');
                tableInput.type = 'text';
                tableInput.value = `${activeTable}.`;
                tableInput.readOnly = true;
                itemContainer.appendChild(tableInput);

                const fieldSelect = document.createElement('select');
                fieldSelect.className = 'field-select';
                
                let pkFieldName = '';
                if (activeTable && jsonData.database.table[activeTable]) {
                    const fields = jsonData.database.table[activeTable].fields;
                    const fieldNames = Object.keys(fields);
                    
                    pkFieldName = fieldNames.find(f => fields[f].primary_key === 1) || 'field_id';

                    fieldNames
                        .filter(f => f !== pkFieldName) // Kecualikan primary key
                        .forEach(fieldName => {
                            const option = document.createElement('option');
                            option.value = fieldName;
                            option.textContent = fieldName;
                            fieldSelect.appendChild(option);
                        });
                }
                itemContainer.appendChild(fieldSelect);
                fieldSelect.addEventListener('change', updateModalCanvasState);

                const idLabel = document.createElement('span');
                idLabel.textContent = `WHERE ${pkFieldName} = ##ID##`;
                idLabel.style.marginLeft = '0.75rem';
                idLabel.style.fontFamily = 'monospace';
                idLabel.style.fontSize = '0.9em';
                idLabel.style.color = 'var(--secondary-color)';
                itemContainer.appendChild(idLabel);
                
                // Laraskan gaya bekas untuk komponen ini
                itemContainer.style.justifyContent = 'flex-start';
                break;
            }
            case 'field':
                const tableSelect = document.createElement('select');
                tableSelect.className = 'table-select';

                // ▼▼▼ MULA PEMBETULAN: Gunakan konteks dari config, bukan querySelector yang rapuh. ▼▼▼
                let activeTable = '';
                if (context && context.tableName) {
                    activeTable = context.tableName;
                } else {
                    // Sandaran (fallback) kepada kaedah lama jika konteks tidak dibekalkan,
                    // dengan pemeriksaan keselamatan untuk mengelakkan ralat.
                    const fieldNameElement = document.querySelector('#field-settings-page .field-name');
                    if (fieldNameElement) {
                        [activeTable] = fieldNameElement.textContent.split('.');
                    }
                }
                // ▲▲▲ TAMAT PEMBETULAN ▲▲▲

                const allTables = Object.keys(jsonData.database.table);
                allTables.forEach(tableName => {
                    const option = document.createElement('option');
                    option.value = tableName;
                    option.textContent = tableName;
                    if (tableName === activeTable) option.selected = true;
                    tableSelect.appendChild(option);
                });
                itemContainer.appendChild(tableSelect);

                const fieldSelect = document.createElement('select');
                fieldSelect.className = 'field-select';
                const populateFields = (tableName) => {
                    fieldSelect.innerHTML = '';
                    if (jsonData.database.table[tableName]) {
                        const fields = Object.keys(jsonData.database.table[tableName].fields);
                        fields.forEach(fieldName => {
                            const option = document.createElement('option');
                            option.value = fieldName;
                            option.textContent = fieldName;
                            fieldSelect.appendChild(option);
                        });
                    }
                };
                tableSelect.addEventListener('change', () => {
                    populateFields(tableSelect.value);
                    updateModalCanvasState();
                });
                populateFields(activeTable);
                itemContainer.appendChild(fieldSelect);
                fieldSelect.addEventListener('change', updateModalCanvasState);
                break;
            case 'comparison_operator': {
                const operatorSelect = document.createElement('select');
                operatorSelect.className = 'operator-select';
                const operators = [
                    { value: '=', text: 'is equal to' },
                    { value: '!=', text: 'is not equal to' },
                    { value: '>', text: 'is greater than' },
                    { value: '<', text: 'is less than' },
                    { value: '>=', text: 'is greater than or equal to' },
                    { value: '<=', text: 'is less than or equal to' },
                    { value: 'LIKE', text: 'contains' },
                    { value: 'NOT LIKE', text: 'does not contain' },
                    { value: 'IN', text: 'is one of (a,b,c)' },
                    { value: 'NOT IN', text: 'is not one of (a,b,c)' },
                    { value: 'IS NULL', text: 'is empty (NULL)' },
                    { value: 'IS NOT NULL', text: 'is not empty (not NULL)' }
                ];
                operators.forEach(op => {
                    const option = document.createElement('option');
                    option.value = op.value;
                    option.textContent = op.text;
                    operatorSelect.appendChild(option);
                });
                itemContainer.appendChild(operatorSelect);
                operatorSelect.addEventListener('change', updateModalCanvasState);
                break;
            }
            case 'logical_operator': {
                const operatorSelect = document.createElement('select');
                operatorSelect.className = 'operator-select';
                const operators = [
                    { value: '&&', text: 'AND' }, { value: '||', text: 'OR' }
                ];
                operators.forEach(op => {
                    const option = document.createElement('option');
                    option.value = op.value;
                    option.textContent = op.text;
                    operatorSelect.appendChild(option);
                });
                itemContainer.appendChild(operatorSelect);
                operatorSelect.addEventListener('change', updateModalCanvasState);
                break;
            }
            case 'arithmetic_operator': {
                const operatorSelect = document.createElement('select');
                operatorSelect.className = 'operator-select';
                const operators = [
                    { value: '+', text: 'Plus (+)' }, { value: '-', text: 'Minus (-)' }, 
                    { value: '*', text: 'Times (*)' }, { value: '/', text: 'Divide (/)' }
                ];
                operators.forEach(op => {
                    const option = document.createElement('option');
                    option.value = op.value;
                    option.textContent = op.text;
                    operatorSelect.appendChild(option);
                });
                itemContainer.appendChild(operatorSelect);
                operatorSelect.addEventListener('change', updateModalCanvasState);
                break;
            }
            case 'boolean': {
                const booleanSelect = document.createElement('select');
                booleanSelect.innerHTML = `<option value="true">True</option><option value="false">False</option>`;
                itemContainer.appendChild(booleanSelect);
                booleanSelect.addEventListener('change', updateModalCanvasState);
                break;
            }
            case 'current_user': {
                const label = document.createElement('span');
                label.textContent = '[CurrentUser].';
                itemContainer.appendChild(label);
                const propertySelect = document.createElement('select');
                propertySelect.className = 'operator-select'; // Guna semula gaya
                const properties = [{value: 'username', text: 'Username'}, {value: 'group', text: 'Group'}, {value: 'groupID', text: 'GroupID'}];
                properties.forEach(prop => {
                    const option = document.createElement('option');
                    option.value = prop.value; option.textContent = prop.text;
                    propertySelect.appendChild(option);
                });
                itemContainer.appendChild(propertySelect);
                propertySelect.addEventListener('change', updateModalCanvasState);
                break;
            }
            case 'current_datetime': {
                const label = document.createElement('span');
                label.textContent = '[Current].';
                itemContainer.appendChild(label);
                const propertySelect = document.createElement('select');
                propertySelect.className = 'operator-select'; // Guna semula gaya
                const properties = [{value: 'datetime', text: 'DateTime'}, {value: 'date', text: 'Date'}, {value: 'time', text: 'Time'}, {value: 'timestamp', text: 'Timestamp'}];
                properties.forEach(prop => {
                    const option = document.createElement('option');
                    option.value = prop.value; option.textContent = prop.text;
                    propertySelect.appendChild(option);
                });
                itemContainer.appendChild(propertySelect);
                propertySelect.addEventListener('change', updateModalCanvasState);
                break;
            }
            case 'null': {
                const itemLabel = document.createElement('span');
                itemLabel.textContent = '[NULL]';
                itemLabel.style.fontFamily = 'monospace';
                itemLabel.style.fontWeight = '600';
                itemContainer.appendChild(itemLabel);
                break;
            }
            case 'open_paren': {
                const itemLabel = document.createElement('span');
                itemLabel.textContent = '(';
                itemContainer.appendChild(itemLabel);
                break;
            }
            case 'close_paren': {
                const itemLabel = document.createElement('span');
                itemLabel.textContent = ')';
                itemContainer.appendChild(itemLabel);
                break;
            }
            case 'string':
                const stringInput = document.createElement('input');
                stringInput.type = 'text';
                stringInput.placeholder = 'Enter value...';
                stringInput.addEventListener('input', updateModalCanvasState);
                itemContainer.appendChild(stringInput);
                break;
            case 'number':
                const numberInput = document.createElement('input');
                numberInput.type = 'number';
                numberInput.placeholder = '0';
                numberInput.addEventListener('input', updateModalCanvasState);
                itemContainer.appendChild(numberInput);
                break;            
                default:
                const itemLabel = document.createElement('span');
                itemLabel.textContent = (type === 'else_if') ? 'ELSE IF' : type.toUpperCase();
                itemContainer.appendChild(itemLabel);
        }
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-algo-item';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Padam komponen ini';
        const targetForDeleteBtn = itemContainer.querySelector('.sql-query-header, .comment-header') || itemContainer;
        targetForDeleteBtn.appendChild(deleteBtn);
        return itemContainer;
    };

    /**
     * Mengesahkan sama ada komponen boleh diletakkan di atas kanvas berdasarkan peraturan.
     * @param {string} componentType - Jenis komponen yang cuba diletakkan.
     * @returns {boolean} - True jika sah, false jika tidak.
     */
    const VALUE_TYPES = ['field', 'this_table_field', 'external_table_field', 'string', 'number', 'sql_query', 'api_endpoint', 'boolean', 'null', 'current_user', 'current_datetime', 'function'];
    const isValidDrop = (componentType) => {
        if (componentType === 'comment') {
            return true;
        }
        const existingComponents = Array.from(canvas.querySelectorAll('.dropped-item'));
        let lastLogicalComponent = null;
        for (let i = existingComponents.length - 1; i >= 0; i--) {
            if (existingComponents[i].dataset.itemType !== 'comment') {
                lastLogicalComponent = existingComponents[i];
                break;
            }
        }
        let lastComponentType = lastLogicalComponent ? lastLogicalComponent.dataset.itemType : 'start';
        if (VALUE_TYPES.includes(lastComponentType)) {
            lastComponentType = 'value';
        }
        const allowedNext = validationRules[lastComponentType];
        if (!allowedNext) {
            showCustomDialog({ title: "Peraturan Dilanggar", message: `Tidak ada peraturan yang ditetapkan selepas komponen '${lastComponentType}'.` });
            return false;
        }
        const isValueDrop = VALUE_TYPES.includes(componentType);
        if (allowedNext.includes(componentType) || (isValueDrop && allowedNext.includes('value'))) {
            return true;
        } else {
            const friendlyNames = allowedNext.map(type => {
                if (type === 'value') return 'sebarang nilai (field, string, nombor, dll.)';
                if (type === 'open_paren') return "'('";
                if (type === 'close_paren') return "')'";
                return `'${type.replace(/_/g, ' ')}'`;
            }).join(' atau ');
            const lastFriendlyName = lastComponentType.replace(/_/g, ' ');
            const message = `Selepas komponen '${lastFriendlyName}', anda hanya boleh meletakkan: ${friendlyNames}.`;
            showCustomDialog({ title: "Peraturan Dilanggar", message: message });
            return false;
        }
    };

    palette.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('algo-component')) {
            const data = {
                type: e.target.dataset.type,
                name: e.target.dataset.functionName
            };
            e.dataTransfer.setData('text/plain', JSON.stringify(data));
        }
    });
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        canvas.classList.add('dragging-over');
    });
    canvas.addEventListener('dragleave', () => {
        canvas.classList.remove('dragging-over');
    });
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        canvas.classList.remove('dragging-over');
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (!isValidDrop(data.type)) {
            return;
        }
        if (placeholder) placeholder.style.display = 'none';
        const newItem = createInteractiveElement(data);
        canvas.appendChild(newItem);
        const newInput = newItem.querySelector('input, textarea');
        if (newInput) newInput.focus();
        updateModalCanvasState();
    });

    canvas.addEventListener('click', (e) => {
        // ▼▼▼ TAMBAH LOGIK KLIK BAHARU DI SINI ▼▼▼
        const configBtn = e.target.closest('.config-lookup-btn');
        if (configBtn) {
            const componentEl = configBtn.closest('.dropped-item');
            openLookupConditionModal(componentEl);
            return; // Hentikan proses selanjutnya
        }
        // ▲▲▲ TAMAT LOGIK KLIK ▲▲▲

        if (e.target.classList.contains('delete-algo-item')) {
            const itemToRemove = e.target.closest('.dropped-item');
            if (!itemToRemove) return;
            const isComment = itemToRemove.dataset.itemType === 'comment';
            if (isComment || !itemToRemove.nextElementSibling) {
                if (itemToRemove.parentElement.classList.contains('function-argument-droppable') && itemToRemove.parentElement.childElementCount === 1) {
                    itemToRemove.parentElement.innerHTML = '<span class="canvas-placeholder">Drop arguments here</span>';
                }
                itemToRemove.remove();
                updateModalCanvasState();
            } else {
                showCustomDialog({ title: "Peraturan", message: "Anda hanya boleh memadam komponen logik dari bawah ke atas (komponen terakhir). Komen boleh dipadam pada bila-bila masa." });
            }
        }
    });

    populateCanvasFromHiddenInput();

    return {
        getState: () => modalCanvasState,
    };
}

/**
 * Mencipta Logic Builder yang berfungsi di dalam modal.
 * @param {object} config - Objek konfigurasi untuk builder.
 * @param {string} config.triggerButtonId - ID butang untuk membuka modal.
 * @param {string} config.modalId - ID elemen modal.
 * @param {string} config.targetInputId - ID input tersembunyi untuk menyimpan output JSON.
 * @param {object} config.validationRules - Tatabahasa (grammar) untuk pengesahan susunan.
 * @param {function} config.getContext - Fungsi untuk mendapatkan data konteks semasa.
 * @param {string} config.closeButtonId - ID butang untuk menutup modal (ikon X).
 * @param {string} config.cancelButtonId - ID butang untuk membatalkan dan menutup modal.
 * @param {string} config.doneButtonId - ID butang untuk menyimpan dan menutup modal.
 */
/**
 * Opens the Logic Builder modal with a given configuration.
 * This is the core, reusable function for showing the builder.
 * @param {object} config - Configuration object.
 * @param {string} config.modalId - The ID of the modal element.
 * @param {string} config.targetInputId - The ID of the hidden input to store the final state.
 * @param {object} config.validationRules - The grammar rules for the builder.
 * @param {function} config.getContext - Function to get the current context (e.g., table name).
 * @param {string} config.closeButtonId - ID of the close button.
 * @param {string} config.cancelButtonId - ID of the cancel button.
 * @param {string} config.doneButtonId - ID of the done button.
 * @param {function} [config.onComplete] - Optional callback when 'Done' is clicked, receives the logic JSON.
 */
export function openModalLogicBuilder(config) {
    const modal = document.getElementById(config.modalId);
    const modalBody = modal.querySelector('.modal-body');
    const hiddenInput = document.getElementById(config.targetInputId);

    if (!modal || !modalBody || !hiddenInput) {
        console.error("Core elements for modal logic builder are missing.");
        return;
    }

    const injectBuilderUI = (targetContainer) => {
        const template = document.getElementById('logic-builder-template');
        if (!template) return null;
        const clone = template.content.cloneNode(true);
        targetContainer.innerHTML = '';
        targetContainer.appendChild(clone);
        return {
            palette: targetContainer.querySelector('.algorithm-palette'),
            canvas: targetContainer.querySelector('.algorithm-canvas')
        };
    };

    const closeBtn = document.getElementById(config.closeButtonId);
    const cancelBtn = document.getElementById(config.cancelButtonId);
    const doneBtn = document.getElementById(config.doneButtonId);

    if (!closeBtn || !cancelBtn || !doneBtn) {
        console.error("Modal control buttons not found.");
        return;
    }

    const ui = injectBuilderUI(modalBody);
    if (!ui) {
        console.error("Failed to inject builder UI into modal.");
        return;
    }
    // Logik untuk menyembunyikan komponen palet yang tidak diperlukan
    if (config.hiddenComponents && Array.isArray(config.hiddenComponents)) {
        // Sembunyikan juga kumpulan "Control Flow" jika semua komponennya disembunyikan
        const controlFlowComponents = ['if', 'else_if', 'then', 'else'];
        const allControlFlowHidden = controlFlowComponents.every(c => config.hiddenComponents.includes(c));

        config.hiddenComponents.forEach(type => {
            const componentEl = ui.palette.querySelector(`.algo-component[data-type="${type}"]`);
            if (componentEl) {
                componentEl.style.display = 'none';
            }
        });

        if (allControlFlowHidden) {
            const controlFlowGroup = ui.palette.querySelector('.algo-component[data-type="if"]')?.parentElement;
            if (controlFlowGroup) {
                controlFlowGroup.style.display = 'none';
            }
        }
    }

    const builderInstance = setupLogicBuilderCore({
        ...ui,
        hiddenInput: hiddenInput,
        validationRules: config.validationRules,
        context: config.getContext(),
        updateMode: 'manual'
    });

    const newDoneBtn = doneBtn.cloneNode(true);
    doneBtn.parentNode.replaceChild(newDoneBtn, doneBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    const closeModal = () => {
        modal.classList.add('hidden');
        modalBody.innerHTML = '';
    };

    newDoneBtn.addEventListener('click', () => {
        const logicJson = builderInstance.getState();
        if (config.onComplete) {
            config.onComplete(logicJson);
        } else {
            hiddenInput.value = logicJson;
            hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        closeModal();
    });

    newCancelBtn.addEventListener('click', closeModal);
    newCloseBtn.addEventListener('click', closeModal);

    modal.classList.remove('hidden');
}


/**
 * Binds a trigger button to open the Logic Builder modal.
 * This is for the original use case where a button on the page opens the builder.
 * @param {object} config - Same configuration as openModalLogicBuilder, plus triggerButtonId.
 */
function initializeModalLogicBuilderBinder(config) {
    const openBtn = document.getElementById(config.triggerButtonId);
    if (!openBtn) {
        // This is not a critical error, as the button might not exist on all pages.
        return;
    }
    openBtn.addEventListener('click', () => openModalLogicBuilder(config));
}

export function showNewProjectModal() {
    configureNewProjectModal('user-initiated'); // <-- TAMBAH BARIS INI

    const modal = document.getElementById('new-project-modal');
    const input = document.getElementById('new-project-name');

    if (modal && input) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            input.focus();
        }, 50);
    }
}

/**
 * Mengkonfigurasi modal 'New Project' berdasarkan senario.
 * @param {string} scenario - 'first-run' atau 'user-initiated'.
 */
export function configureNewProjectModal(scenario) {
    const modal = document.getElementById('new-project-modal');
    if (!modal) return;

    const titleEl = modal.querySelector('.modal-header h3');
    const closeBtn = modal.querySelector('#new-project-modal-close');

    if (scenario === 'first-run') {
        if (titleEl) titleEl.textContent = 'Welcome! Please Create Your First Project';
        if (closeBtn) closeBtn.style.display = 'none'; // Sembunyikan butang X
    } else { // 'user-initiated'
        if (titleEl) titleEl.textContent = 'Create New Project';
        if (closeBtn) closeBtn.style.display = 'block'; // Paparkan butang X
    }
}

/**
 * Mengaplikasikan saiz fon pada elemen akar (<html>) aplikasi.
 * @param {string} size - Pilihan saiz ('small', 'medium', 'large').
 */
export function applyFontSize(size) {
    let fontSizeValue = '16px';
    if (size === 'small') fontSizeValue = '14px';
    else if (size === 'large') fontSizeValue = '18px';
    document.documentElement.style.fontSize = fontSizeValue;
}

import { allTableNames, jsonData, loadProjectData, activeProject, SaveManager, isAutoSaveEnabled, isPopulatingData, lastActiveChildTable, setLastActiveChildTable, setAwaitingMenuGroupSave } from './js.main.js';

// TAMBAH DUA FUNGSI BAHARU INI DALAM uiHandlers.js

/**
 * Mengemas kini imej di dalam kotak "Template preview" berdasarkan
 * pilihan semasa dropdown 'tbl-tv-template'.
 */
function updateTableViewTemplatePreview() {
    const templateSelect = document.getElementById('tbl-tv-template');
    const previewArea = document.querySelector('#tab-template .theme-preview-window');

    if (!templateSelect || !previewArea) {
        console.warn("Elemen untuk template preview tidak ditemui.");
        return;
    }

    const selectedValue = templateSelect.value;
    if (selectedValue) {
        const imagePath = `images/${selectedValue}.png`;
        previewArea.innerHTML = `<img src="${imagePath}" alt="Preview untuk template ${selectedValue}" style="width: 100%; object-fit: contain;">`;
    } else {
        // Jika tiada pilihan, paparkan teks lalai
        previewArea.innerHTML = '<p style="text-align: center; color: var(--secondary-color);">Template preview area</p>';
    }
}

/**
 * Memasang event listener pada dropdown 'tbl-tv-template'
 * supaya ia mengemas kini imej setiap kali pilihan ditukar.
 */
export function initializeTemplatePreviewHandlers() {
    const templateSelect = document.getElementById('tbl-tv-template');
    if (templateSelect) {
        templateSelect.addEventListener('change', updateTableViewTemplatePreview);
    }
}

/**
 * Fungsi Pengasas untuk Algorithm Builder pada tetapan medan.
 * Ia mentakrifkan konfigurasi dan memanggil fungsi teras.
 */
export function initializeAlgorithmBuilder() {
    // Grammar baharu berasaskan keadaan (state-based)
    const COMPLEX_ALGORITHM_GRAMMAR = {
        // Key: jenis komponen SEBELUMNYA. Value: array jenis komponen BERIKUTNYA yang dibenarkan.
        'start':               ['if', 'open_paren', 'value'],
        'if':                  ['value', 'open_paren'],
        'else_if':             ['value', 'open_paren'],
        'then':                ['value', 'open_paren'],
        'else':                ['value', 'open_paren'],
        'value':               ['comparison_operator', 'arithmetic_operator', 'logical_operator', 'then', 'else', 'else_if', 'close_paren'],
        'comparison_operator': ['value', 'open_paren'],
        'arithmetic_operator': ['value', 'open_paren'],
        'logical_operator':    ['value', 'open_paren', 'if'],
        'open_paren':          ['value', 'if', 'open_paren'],
        'close_paren':         ['comparison_operator', 'arithmetic_operator', 'logical_operator', 'then', 'else', 'else_if', 'close_paren'],
    };

    const enableCheckbox = document.getElementById('fld-algorithm-enable');
    const builderContainer = document.getElementById('algorithm-builder-container');
    const hiddenInput = document.getElementById('fld-algorithm-logic');

    if (!enableCheckbox || !builderContainer || !hiddenInput) {
        console.error("Elemen untuk Algorithm Builder tidak ditemui.");
        return;
    }

    // Fungsi untuk menyuntik UI builder dari template
    const injectBuilderUI = (targetContainer) => {
        const template = document.getElementById('logic-builder-template');
        if (!template) return null;

        const clone = template.content.cloneNode(true);
        targetContainer.innerHTML = ''; // Kosongkan dahulu
        targetContainer.appendChild(clone);

        return {
            palette: targetContainer.querySelector('.algorithm-palette'),
            canvas: targetContainer.querySelector('.algorithm-canvas')
        };
    };

    enableCheckbox.addEventListener('change', () => {
        if (enableCheckbox.checked) {
            builderContainer.classList.remove('hidden');
            const ui = injectBuilderUI(builderContainer);
            if (ui) {
                setupLogicBuilderCore({
                    ...ui,
                    hiddenInput: hiddenInput,
                    validationRules: COMPLEX_ALGORITHM_GRAMMAR,
                    context: {
                        tableName: document.querySelector('#field-settings-page .field-name')?.textContent.split('.')[0]
                    },
                    updateMode: 'live'
                });
            }
        } else {
            builderContainer.classList.add('hidden');
        }
    });
}

/**
 * Fungsi Pengasas untuk Algorithm Builder bagi 'Table Hook'.
 * @deprecated This functionality is now handled by the Workflow Builder in workflowBuilder.js
 */
export function initializeTableHookBuilder() {
    // This functionality is now handled by the Workflow Builder in workflowBuilder.js
}

/**
 * Fungsi Pengasas untuk Algorithm Builder bagi 'Project Hook'.
 * @deprecated This functionality is now handled by the Workflow Builder in workflowBuilder.js
 */
export function initializeProjectHookBuilder() {
    // This functionality is now handled by the Workflow Builder in workflowBuilder.js
}

// KOD PENUH: Gantikan keseluruhan fungsi ini.
export function initializeLookupFieldSaveHandler() {
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    if (!parentTableSelect) return;

    parentTableSelect.addEventListener('change', () => {
		if (isPopulatingData) return;
		if (!isAutoSaveEnabled) return;
        
        const parentTableName = parentTableSelect.value;
        const [childTableName, fk_child_field] = document.querySelector('#field-settings-page .field-name').textContent.split('.');
        
        // Hantar tugasan "upsert" ke queue
        SaveManager.addToQueue('upsertRelationship', null, {
            parentTableName,
            childTableName,
            fk_child_field
        });
    });
}

// GANTIKAN FUNGSI SEDIA ADA INI DALAM: uiHandlers.js

export function initializeRelationshipSaveHandlers() {
    const form = document.getElementById('tab-detail-parent-child');
    if (!form) return;

    const handleInputChange = (event) => {
        if (isPopulatingData) return;
        if (!isAutoSaveEnabled) return;

        // Dapatkan ID hubungan (relationship) yang sedang aktif
        const parentTable = document.querySelector('#table-settings-page .table-name').textContent;
        const childTableElement = form.querySelector('.item-list li.active');
        if (!childTableElement) return; // Keluar jika tiada child table dipilih
        const childTable = childTableElement.dataset.childName;

        const relationship = jsonData.database.relationships.find(
            r => r.parent_table_name === parentTable && r.child_table_name === childTable
        );
        if (!relationship) return; // Keluar jika hubungan tidak ditemui
        const relationshipId = relationship.relationship_id;

        // Dapatkan perubahan spesifik yang dibuat
        const input = event.target;
        const key = input.id.replace('parentchild-', '').replace(/-/g, '_');
        const value = (input.type === 'checkbox') ? (input.checked ? 1 : 0) : input.value;
        const dataToSave = { [key]: value };

        // Hantar perubahan ke queue di bawah 'relationships'
        SaveManager.addToQueue('relationships', relationshipId, dataToSave);
    };

    form.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', handleInputChange);
        if (input.type === 'text') {
            input.addEventListener('input', handleInputChange);
        }
    });
}

// GANTIKAN FUNGSI SEDIA ADA INI DALAM: uiHandlers.js

export function initializeProjectSaveHandlers() {
    const form = document.getElementById('main-dashboard-page');
    // 'app-title' berada di luar 'main-dashboard-page', jadi kita perlu sasarkannya secara berasingan
    const header = document.querySelector('.main-header'); 
    if (!form || !header) return;

    const handleInputChange = (event) => {
        if (isPopulatingData) return;
        if (!isAutoSaveEnabled) return;

        const input = event.target;
        let key = (input.type === 'radio')
            ? input.name.replace('app-', '').replace(/-/g, '_')
            : input.id.replace('app-', '').replace(/-/g, '_');
        
        // ▼▼▼ PENAMBAHBAIKAN: KES KHAS UNTUK 'app-title' DAN HOOKS ▼▼▼
        if (key === 'title') {
            key = 'app_title';
        } else if (input.id === 'app-hook-logic') {
            key = 'project_hook_workflow';
        }
        // ▲▲▲ TAMAT PENAMBAHBAIKAN ▲▲▲
        
        let value;
        if (input.type === 'checkbox') {
            value = input.checked ? 1 : 0;
        } else if (input.type === 'radio') {
            if (!input.checked) return;
            value = input.value;
        } else {
            value = input.value;
        }

        const dataToSave = { [key]: value };
        
        // Guna project_id dari activeProject yang sudah ada dalam memori
        SaveManager.addToQueue('project', activeProject.project_id, dataToSave);
    };

    // Pasang event listener pada semua elemen borang di papan pemuka utama DAN di header
    header.querySelectorAll('input, select').forEach(input => {
        if (input.id === 'app-title') {
            input.addEventListener('input', handleInputChange);
        } else {
            input.addEventListener('change', handleInputChange);
        }
    });

    form.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', handleInputChange);
    });

    // Specifically listen for the 'input' event on the hook logic field
    const projectHookInput = document.getElementById('app-hook-logic');
    if (projectHookInput) {
        projectHookInput.addEventListener('input', handleInputChange);
    }
}

// GANTIKAN FUNGSI SEDIA ADA INI DALAM: uiHandlers.js

export function initializeTableSaveHandlers() {
    const form = document.getElementById('table-settings-page');
    if (!form) return;

    const handleInputChange = (event) => {
        if (isPopulatingData) return;
        if (!isAutoSaveEnabled) return;

        const input = event.target;

        // ▼▼▼ PENAMBAHBAIKAN: Guard Clause ▼▼▼
        // Hanya proses event dari elemen yang mempunyai ID bermula dengan 'tbl-'
        if (!input.id || !input.id.startsWith('tbl-')) {
            return;
        }
        // ▲▲▲ TAMAT PENAMBAHBAIKAN ▲▲▲

        const tableName = document.querySelector('#table-settings-page .table-name').textContent;
        const tableData = jsonData.database.table[tableName];
        if (!tableData) return;
        const tableId = tableData.table_id;
        
        let key = input.id.replace('tbl-', '').replace(/-/g, '_');
        if (input.id === 'tbl-hook-logic') {
            key = 'table_hook_workflow';
        }
        const value = (input.type === 'checkbox') ? (input.checked ? 1 : 0) : input.value;
        const dataToSave = { [key]: value };

        SaveManager.addToQueue('tables', tableId, dataToSave);
    };

    form.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('change', handleInputChange);
        if (input.type === 'text' || input.type === 'number' || input.tagName.toLowerCase() === 'textarea' || input.type === 'hidden') {
            input.addEventListener('input', handleInputChange);
        }
    });
}

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

export function initializeFieldSaveHandlers() {
    const form = document.getElementById('field-settings-page');
    if (!form) return;
    const handleInputChange = (event) => {
        if (isPopulatingData) return;
        const [tableName, fieldName] = document.querySelector('#field-settings-page .field-name').textContent.split('.');
        if (!tableName || !fieldName || !jsonData.database.table[tableName] || !jsonData.database.table[tableName].fields[fieldName]) return;
        const fieldId = jsonData.database.table[tableName].fields[fieldName].field_id;
        const input = event.target;
        const key = (input.name && input.type === 'radio') ? input.name.replace('fld-', '').replace(/-/g, '_') : input.id.replace('fld-', '').replace(/-/g, '_');
        let value;
        if (input.type === 'checkbox') value = input.checked ? 1 : 0;
        else if (input.type === 'radio') { if (!input.checked) return; value = input.value; }
        else value = input.value;
        SaveManager.addToQueue('fields', fieldId, { [key]: value });
    };
    form.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('change', handleInputChange);
        if (input.type === 'text' || input.type === 'number' || input.tagName.toLowerCase() === 'textarea' || input.type === 'hidden') {
            input.addEventListener('input', handleInputChange);
        }
    });
}

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

export async function populateProjectDropdown() {
    const projectListContainer = document.getElementById('project-menu-list');
    let newProjectBtn = document.getElementById('new-project-btn-dropdown');
    const newProjectModal = document.getElementById('new-project-modal');

    if (!projectListContainer || !newProjectBtn || !newProjectModal) return;

    projectListContainer.querySelectorAll('.project-item').forEach(item => item.remove());

    const projects = await window.electronAPI.getAllProjects();

    projects.forEach(project => {
        const projectLink = document.createElement('a');
        projectLink.href = '#';
        projectLink.textContent = project.app_title;
        projectLink.className = 'project-item';
        if (project.is_active) {
            projectLink.classList.add('active-project');
        }
        
        projectLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const overlay = document.getElementById('loading-overlay');
            try {
                if (overlay) overlay.classList.remove('loading-overlay-hidden');

                const newActiveProject = await window.electronAPI.setActiveProject(project.project_id);
                if (newActiveProject) {
                    await loadProjectData(newActiveProject);
                }
            } catch (error) {
                console.error("Gagal menukar projek:", error);
                showCustomDialog({ title: "Error", message: `Gagal menukar projek: ${error.message}` });
            } finally {
                if (overlay) overlay.classList.add('loading-overlay-hidden');
            }
        });

        projectListContainer.appendChild(projectLink);
    });

    // Guna kaedah cloneNode untuk membuang semua event listener lama dari butang
    // sebelum menambah event listener yang baharu dan terkini.
    const newProjectBtnClone = newProjectBtn.cloneNode(true);
    newProjectBtn.parentNode.replaceChild(newProjectBtnClone, newProjectBtn);
    newProjectBtn = newProjectBtnClone; // Sasarkan semula pembolehubah kepada klon yang baharu

    newProjectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showNewProjectModal();
    });
}

export function showCustomDialog({ title, message, onOk, onCancel, showCancelButton = false }) {
    const modal = document.getElementById('custom-alert-modal');
    const titleEl = document.getElementById('custom-alert-title');
    const messageEl = document.getElementById('custom-alert-message');
    const okBtn = document.getElementById('custom-alert-ok-btn');
    const cancelBtn = document.getElementById('custom-alert-cancel-btn');
    const closeBtn = document.getElementById('custom-alert-close');

    titleEl.textContent = title || 'Notification';
    messageEl.textContent = message;

    // Tunjukkan atau sembunyikan butang Cancel
    cancelBtn.style.display = showCancelButton ? 'inline-block' : 'none';

    // Fungsi untuk menutup modal dan membuang listener
    const closeModal = () => {
        modal.classList.add('hidden');
        // Buang listener lama untuk elak panggilan berganda
        okBtn.replaceWith(okBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        closeBtn.replaceWith(closeBtn.cloneNode(true));
    };

    // Tambah listener baharu
    document.getElementById('custom-alert-ok-btn').addEventListener('click', () => {
        if (typeof onOk === 'function') {
            onOk();
        }
        closeModal();
    });

    document.getElementById('custom-alert-cancel-btn').addEventListener('click', () => {
        if (typeof onCancel === 'function') {
            onCancel();
        }
        closeModal();
    });

    document.getElementById('custom-alert-close').addEventListener('click', closeModal);

    modal.classList.remove('hidden');
}

// (Pastikan helper ini wujud di skop yang boleh diakses)
const setElementValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
        if (element.type === 'checkbox' || element.type === 'radio') {
            element.checked = !!value;
        } else {
            element.value = value || '';
        }
    }
};

const setRadioValue = (name, value) => {
    const selector = `input[name="${name}"][value="${value}"]`;
    const element = document.querySelector(selector);
    if (element) element.checked = true;
};

// Pembolehubah untuk menjejaki kumpulan mana yang sedang diubah suai
let currentTargetMenuSelector = null;

/**
 * Mendapatkan senarai nama menu (jadual) yang telah digunakan dalam semua kumpulan.
 * @returns {string[]} Senarai nama menu yang telah digunakan.
 */
function getUsedMenuNames() {
    const usedTags = document.querySelectorAll('.menu-group-item .tag');
    // Ambil teks dari setiap tag dan buang butang 'x'
    return [...usedTags].map(tag => tag.childNodes[0].textContent.trim());
}

// uiHandlers.js

/**
 * Mencipta elemen HTML untuk satu baris item menu custom.
 * @param {object} item - Objek data untuk item menu.
 * @returns {HTMLElement} Elemen div yang mewakili baris tersebut.
 */
// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

function createCustomMenuItem(item) {
    const itemEl = document.createElement('div');
    itemEl.className = 'custom-menu-item';
    itemEl.setAttribute('draggable', 'true'); // <-- TAMBAH BARIS INI
    // Simpan data pada elemen untuk rujukan mudah
    itemEl.dataset.label = item.item_label || '';
    itemEl.dataset.url = item.item_url || '';
    itemEl.dataset.itemId = item.item_id || '';

    itemEl.innerHTML = `
        <i class="fas fa-grip-vertical drag-handle" style="cursor: ns-resize;"></i>
        <div class="form-group">
            <label style="font-size: 0.8em;">Menu Label</label>
            <input type="text" readonly value="${item.item_label || ''}" placeholder="Not set">
        </div>
        <div class="form-group">
            <label style="font-size: 0.8em;">URL</label>
            <input type="text" readonly value="${item.item_url || ''}" placeholder="Not set">
        </div>
        <button class="btn-sidebar-icon custom-menu-edit-btn" title="Edit custom menu">
            <i class="fas fa-pencil-alt"></i>
        </button>
        <button class="btn-sidebar-icon custom-menu-delete-btn" title="Delete custom menu">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;
    return itemEl;
}

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: src/uiHandlers.js

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: src/uiHandlers.js

export function initializeMenuManagementHandlers() {
    const menuManagementTab = document.getElementById('tab-menu-appearance');
    if (!menuManagementTab) return;

    const addGroupBtn = document.getElementById('app-add_menu_group');
    const addCustomMenuBtn = document.getElementById('app-add_custom_menu');
    const menuGroupList = document.querySelector('.menu-group-list');
    const customMenuList = document.getElementById('custom-menu-list');
    const addMenuModal = document.getElementById('add-menu-modal');
    const availableMenusList = document.getElementById('available-menus-list');
    const groupModalCloseBtn = addMenuModal?.querySelector('.modal-close');

    if (!addGroupBtn || !addCustomMenuBtn || !menuGroupList || !customMenuList || !addMenuModal) return;

    let currentTargetMenuSelector = null;

    // --- FUNGSI-FUNGSI BANTUAN (TIADA PERUBAHAN) ---
    const gatherMenuData = () => {
        const groupElements = menuGroupList.querySelectorAll('.menu-group-item');
        const groups = Array.from(groupElements).map((groupEl, groupIndex) => {
            const groupName = groupEl.querySelector('.group-name-input').value;
            const itemElements = groupEl.querySelectorAll('.menu-selector .tag');
            const items = Array.from(itemElements).map((itemEl, itemIndex) => ({
                table_name: itemEl.childNodes[0].textContent.trim(), item_order: itemIndex
            }));
            return { group_name: groupName, items, group_order: groupIndex };
        });
        let individualOrder = 0;
        const individualTableMenus = Array.from(menuManagementTab.querySelectorAll('#individual-table-menus input[type="checkbox"]:checked'))
            .map(checkbox => ({
                table_name: checkbox.dataset.tableName, order: individualOrder++
            }));
        return { groups: groups, individual_items: individualTableMenus };
    };

    const triggerSave = () => {
        const menuData = gatherMenuData();
        SaveManager.addToQueue('menus', null, menuData);
    };
    
    const openCustomMenuModal = (itemEl = null) => {
        const modal = document.getElementById('custom-menu-modal');
        // ... (Fungsi ini dikekalkan sepenuhnya tanpa perubahan)
        if (!modal) return;
        const title = modal.querySelector('#custom-menu-modal-title');
        const labelInput = modal.querySelector('#custom-menu-label-input');
        const urlInput = modal.querySelector('#custom-menu-url-input');
        const tableSelect = modal.querySelector('#custom-menu-url-table-select');
        const itemIdInput = modal.querySelector('#custom-menu-item-id');
        const okBtn = modal.querySelector('#custom-menu-modal-ok');
        const cancelBtn = modal.querySelector('#custom-menu-modal-cancel');
        const closeBtn = modal.querySelector('#custom-menu-modal-close');
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        const closeModal = () => modal.classList.add('hidden');
        cancelBtn.addEventListener('click', closeModal, { once: true });
        closeBtn.addEventListener('click', closeModal, { once: true });
        tableSelect.innerHTML = '<option value="">-- Choose a Table --</option>';
        allTableNames.forEach(name => {
            tableSelect.innerHTML += `<option value="${name}">${name}</option>`;
        });
        if (itemEl) {
            title.textContent = 'Edit Custom Menu';
            labelInput.value = itemEl.dataset.label;
            urlInput.value = itemEl.dataset.url;
            itemIdInput.value = itemEl.dataset.itemId;
        } else {
            title.textContent = 'Add Custom Menu';
            labelInput.value = '';
            urlInput.value = '';
            itemIdInput.value = '';
        }
        newOkBtn.addEventListener('click', async () => {
            const dataToSave = {
                project_id: activeProject.project_id,
                item_id: itemIdInput.value || null,
                label: labelInput.value,
                url: urlInput.value
            };
            const result = await window.electronAPI.saveCustomMenuItem(dataToSave);
            if (result.success) {
                closeModal();
                const tablePage = document.getElementById('table-settings-page');
                const tableName = tablePage.classList.contains('hidden') ? null : tablePage.querySelector('.table-name')?.textContent;
                await loadProjectData(activeProject, tableName);
            } else {
                showCustomDialog({ title: "Error", message: `Failed to save custom menu: ${result.message}` });
            }
        }, { once: true });
        modal.classList.remove('hidden');
        labelInput.focus();
    };

    // --- PENGENDALI ACARA (EVENT HANDLERS) LAIN (TIADA PERUBAHAN) ---
    addCustomMenuBtn.addEventListener('click', () => openCustomMenuModal());
    document.getElementById('custom-menu-url-table-select').addEventListener('change', (e) => {
        const urlInput = document.getElementById('custom-menu-url-input');
        if (e.target.value) urlInput.value = `${e.target.value}_view.php?SelectedID=`;
    });
    if (groupModalCloseBtn) groupModalCloseBtn.addEventListener('click', () => addMenuModal.classList.add('hidden'));
    if (availableMenusList) {
        availableMenusList.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                const menuName = e.target.dataset.menuName;
                if (menuName && currentTargetMenuSelector) {
                    const newTag = document.createElement('span');
                    newTag.className = 'tag';
                    newTag.setAttribute('draggable', 'true');
                    newTag.innerHTML = `${menuName} <button class="remove-tag">&times;</button>`;
                    const addBtn = currentTargetMenuSelector.querySelector('.add-menu-btn');
                    currentTargetMenuSelector.insertBefore(newTag, addBtn);
                    addMenuModal.classList.add('hidden');
                    currentTargetMenuSelector = null;
                    triggerSave();
                }
            }
        });
    }
    menuManagementTab.addEventListener('change', (e) => { if (e.target.matches('#individual-table-menus input[type="checkbox"]')) triggerSave(); });
    menuManagementTab.addEventListener('input', (e) => { if (e.target.matches('.group-name-input')) triggerSave(); });
    
    // PENGENDALI KLIK UTAMA (TERMASUK FUNGSI PADAM YANG STABIL - TIDAK DIUBAH)
    menuManagementTab.addEventListener('click', (e) => {
        const target = e.target;
        const customItem = target.closest('.custom-menu-item');
        const groupItem = target.closest('.menu-group-item');

        if (target.closest('.custom-menu-delete-btn') && customItem) {
            showCustomDialog({
                title: "Confirm Deletion", message: "Are you sure you want to delete this custom menu?", showCancelButton: true,
                onOk: async () => {
                    await window.electronAPI.saveCustomMenuItem({ item_id: customItem.dataset.itemId, project_id: activeProject.project_id, label: 'DELETE', url: 'DELETE' });
                    const tablePage = document.getElementById('table-settings-page');
                    const tableName = tablePage.classList.contains('hidden') ? null : tablePage.querySelector('.table-name')?.textContent;
                    await loadProjectData(activeProject, tableName);
                }
            });
        } else if (target.closest('.custom-menu-edit-btn') && customItem) {
            openCustomMenuModal(customItem);
        } else if (target.classList.contains('add-menu-btn') && groupItem) {
            const usedNames = new Set([...menuGroupList.querySelectorAll('.tag')].map(tag => tag.childNodes[0].textContent.trim()));
            const availableTables = allTableNames.filter(name => !usedNames.has(name));
            availableMenusList.innerHTML = availableTables.map(name => `<li data-menu-name="${name}">${name}</li>`).join('');
            currentTargetMenuSelector = target.closest('.menu-selector');
            addMenuModal.classList.remove('hidden');
        } else if (target.classList.contains('remove-tag') && groupItem) {
            target.closest('.tag')?.remove();
            triggerSave();
        } else if (target.closest('.group-actions button') && groupItem) {
            showCustomDialog({
                title: "Confirm Deletion", message: "Are you sure you want to delete this menu group?", showCancelButton: true,
                onOk: () => { groupItem.remove(); triggerSave(); }
            });
        }
    });

    addGroupBtn.addEventListener('click', () => {
        if (menuGroupList.querySelector('.empty-state-label')) menuGroupList.innerHTML = '';
        const newGroup = document.createElement('div');
        newGroup.className = 'menu-group-item';
        newGroup.setAttribute('draggable', 'true');
        newGroup.innerHTML = `<i class="fas fa-grip-vertical drag-handle"></i><input type="text" class="group-name-input" value="New Group"><div class="menu-selector"><button class="add-menu-btn" title="Add menu to this group">+</button></div><div class="group-actions"><button class="btn-sidebar-icon" title="Delete group"><i class="fas fa-trash-alt"></i></button></div>`;
        menuGroupList.appendChild(newGroup);
		document.getElementById('loading-overlay')?.classList.remove('loading-overlay-hidden');
        setAwaitingMenuGroupSave(true);
        triggerSave();
    });

    // ▼▼▼ SISTEM DRAG & DROP BERSEPADU YANG DIPERBAIKI ▼▼▼
    let draggedItem = null;

    const getDragAfterElement = (container, coordinate, selector, isVertical) => {
        const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = (isVertical ? coordinate - box.top : coordinate - box.left) - (isVertical ? box.height : box.width) / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    menuManagementTab.addEventListener('dragstart', (e) => {
        if (e.target.matches('.menu-group-item, .custom-menu-item, .tag')) {
            draggedItem = e.target;
            setTimeout(() => { if (draggedItem) draggedItem.classList.add('dragging'); }, 0);
        }
    });

    menuManagementTab.addEventListener('dragend', async () => {
        if (!draggedItem) return;
        draggedItem.classList.remove('dragging');
        
        if (draggedItem.matches('.menu-group-item, .tag')) {
            triggerSave();
        } else if (draggedItem.matches('.custom-menu-item')) {
            const orderedItems = Array.from(customMenuList.querySelectorAll('.custom-menu-item'))
                .map((item, index) => ({ item_id: item.dataset.itemId, order: index }));
            await window.electronAPI.updateIndividualMenuOrder(orderedItems);
        }
        draggedItem = null;
    });

    // ▼▼▼ PEMBETULAN UTAMA PADA 'dragover' DAN 'drop' ▼▼▼
    menuManagementTab.addEventListener('dragover', (e) => {
        if (!draggedItem) return;

        let isValidDropTarget = false;
        
        // Tentukan sama ada target adalah zon jatuhan yang sah
        if (draggedItem.matches('.menu-group-item') && e.target.closest('.menu-group-list')) {
            isValidDropTarget = true;
        } else if (draggedItem.matches('.custom-menu-item') && e.target.closest('#custom-menu-list')) {
            isValidDropTarget = true;
        } else if (draggedItem.matches('.tag') && e.target.closest('.menu-selector')) {
            isValidDropTarget = true;
        }

        if (isValidDropTarget) {
            e.preventDefault(); // Benarkan 'drop' hanya pada target yang sah
        }
    });

    menuManagementTab.addEventListener('drop', (e) => {
        if (!draggedItem) return;
        e.preventDefault();

        let dropZone, isVertical, selector, coordinate, referenceElement;

        // Tentukan parameter untuk memasukkan item berdasarkan jenis dan zon jatuhan
        if (draggedItem.matches('.menu-group-item') && e.target.closest('.menu-group-list')) {
            dropZone = e.target.closest('.menu-group-list');
            selector = '.menu-group-item';
            isVertical = true;
            coordinate = e.clientY;
        } else if (draggedItem.matches('.custom-menu-item') && e.target.closest('#custom-menu-list')) {
            dropZone = e.target.closest('#custom-menu-list');
            selector = '.custom-menu-item';
            isVertical = true;
            coordinate = e.clientY;
        } else if (draggedItem.matches('.tag') && e.target.closest('.menu-selector')) {
            dropZone = e.target.closest('.menu-selector');
            selector = '.tag';
            isVertical = false;
            coordinate = e.clientX;
            referenceElement = dropZone.querySelector('.add-menu-btn');
        }

        if (dropZone) {
            const afterElement = getDragAfterElement(dropZone, coordinate, selector, isVertical);
            dropZone.insertBefore(draggedItem, afterElement || referenceElement);
        }
    });
    // ▲▲▲ TAMAT PEMBETULAN ▲▲▲
}

// =================================================================
// ▼▼▼ FUNGSI UNTUK MENGISI MODAL TETAPAN ▼▼▼
// =================================================================
async function populateSettingsModal() {
    const settings = await window.electronAPI.getAllSettings();
    if (!settings) {
        console.error("Tidak dapat memuatkan tetapan.");
        return;
    }

    const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value === '1';
            } else {
                element.value = value;
            }
        }
    };
    
    // General
    setValue('fizisys-check-updates', settings.check_updates);
    setValue('fizisys-autosave-interval', settings.autosave_interval);
    setValue('fizisys-show-begin-box', settings.show_begin_box);
    const fontSizeRadio = document.querySelector(`input[name="fizisys-font-size"][value="${settings.font_size}"]`);
    if (fontSizeRadio) fontSizeRadio.checked = true;
    setValue('fizisys-doc-root', settings.doc_root);
    setValue('fizisys-base-url', settings.base_url);
    // Field defaults
    setValue('fizisys-field-default-type', settings.field_default_type);
    setValue('fizisys-field-default-length', settings.field_default_length);
    // Table defaults
    setValue('fizisys-table-suggest-icon', settings.table_suggest_icon);
    setValue('fizisys-table-allow-csv', settings.table_allow_csv);
    setValue('fizisys-table-dv-separate-page', settings.table_dv_separate_page);
    setValue('fizisys-table-hide-save-as-copy', settings.table_hide_save_as_copy);
    setValue('fizisys-table-allow-add-from-homepage', settings.table_allow_add_from_homepage);
    setValue('fizisys-table-show-record-count', settings.table_show_record_count);
    // Project defaults
    setValue('fizisys-project-encoding', settings.project_encoding);
    setValue('fizisys-project-rtl', settings.project_rtl);
    setValue('fizisys-project-doxygen', settings.project_doxygen);
    setValue('fizisys-project-hide-footer', settings.project_hide_footer);
    setValue('fizisys-max-entries', settings.max_entries);
    setValue('fizisys-project-no-trim', settings.project_no_trim);
}


// =================================================================
// ▼▼▼ FUNGSI-FUNGSI UI YANG DIEKSPORT ▼▼▼
// =================================================================

export function updateActionButtonsState() {
    const activeLink = document.querySelector('.sidebar .nav-list a.active');
    const newFieldBtn = document.getElementById('btn-new-field');
    const moveUpBtn = document.getElementById('btn-move-up');
    const moveDownBtn = document.getElementById('btn-move-down');
    const deleteBtn = document.getElementById('btn-delete');
    const isDisabled = !(activeLink && activeLink.closest('.submenu'));
    if (newFieldBtn) newFieldBtn.disabled = isDisabled;
    if (moveUpBtn) moveUpBtn.disabled = isDisabled;
    if (moveDownBtn) moveDownBtn.disabled = isDisabled;
    if (deleteBtn) deleteBtn.disabled = isDisabled;
}

export function initializeTabSystems() {
    // Cari semua bekas tab dalam dokumen
    const allTabContainers = document.querySelectorAll('.tabs-container');

    allTabContainers.forEach(container => {
        // :scope memastikan kita hanya memilih anak-anak terus dari bekas ini
        const tabLinks = container.querySelectorAll(':scope > .tabs-nav > .tab-link');
        
        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.dataset.tab;
                const contentContainer = container.querySelector(':scope > .tabs-content');
                const targetPane = contentContainer.querySelector(`#${tabId}`);

                // Nyahaktifkan semua link dan pane pada tahap yang sama
                link.closest('.tabs-nav').querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
                contentContainer.querySelectorAll(':scope > .tab-pane').forEach(p => p.classList.remove('active'));

                // Aktifkan link yang diklik dan panel sasarannya
                link.classList.add('active');
                if (targetPane) {
                    targetPane.classList.add('active');

                    // ▼▼▼ KEMAS KINI UTAMA ADA DI SINI ▼▼▼
                    // Selepas mengaktifkan panel utama, semak jika ia mempunyai sub-tab.
                    const nestedTabs = targetPane.querySelector('.tabs-container');
                    if (nestedTabs) {
                        // Jika ada, cari pautan tab pertama dalam sub-tab itu.
                        const firstSubTabLink = nestedTabs.querySelector('.tabs-nav .tab-link');
                        if (firstSubTabLink) {
                            // Cetuskan klik pada pautan sub-tab pertama untuk mengaktifkannya.
                            firstSubTabLink.click();
                        }
                    }
                }
            });
        });

        // Pastikan tab pertama sentiasa aktif semasa permulaan
        if (tabLinks.length > 0 && !container.querySelector('.tabs-nav > .tab-link.active')) {
            tabLinks[0].click();
        }
    });
}

// ▼▼▼ FUNGSI-FUNGSI YANG HILANG SEBELUM INI KINI TELAH DIKEMBALIKAN ▼▼▼
function populateSortByDropdown(tableName, elementId = 'tbl-default-sort-by') {
    const sortByDropdown = document.getElementById(elementId);
    if (!sortByDropdown || !jsonData) return;
    
    // Kosongkan senarai sedia ada
    sortByDropdown.innerHTML = (elementId === 'tbl-default-sort-by') ? '<option value="">None</option>' : '';
    
    const table = jsonData.database.table[tableName];
    if (table && table.fields) {
        for (const fieldName in table.fields) {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            sortByDropdown.appendChild(option);
        }
    }
}

// js/uiHandlers.js

function populateFocusFieldDropdown(tableName) {
    const defaultFocusDropdown = document.getElementById('tbl-default-focus');
    if (!defaultFocusDropdown || !jsonData) return;

    defaultFocusDropdown.innerHTML = ''; // Kosongkan senarai

    const table = jsonData.database.table[tableName];
    if (table && table.fields) {
        // ▼▼▼ KEMAS KINI UTAMA DI SINI ▼▼▼
        // 1. Dapatkan semua nama medan
        const allFieldNames = Object.keys(table.fields);

        // 2. Tapis untuk mendapatkan medan yang boleh disunting sahaja
        const editableFields = allFieldNames.filter(fieldName => {
            return table.fields[fieldName].read_only !== 1;
        });
        // ▲▲▲ TAMAT KEMAS KINI ▲▲▲

        const firstEditableField = editableFields.length > 0 ? editableFields[0] : '';
        
        defaultFocusDropdown.innerHTML = `<option value="${firstEditableField}">First editable field (${firstEditableField})</option><option value="__none__">Don't focus any field</option>`;
        
        // 3. Gunakan senarai yang telah ditapis untuk menjana opsyen
        editableFields.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            defaultFocusDropdown.appendChild(option);
        });
    }
}

export function initializeModalHandlers() {
    const configBtn = document.getElementById('config-btn');
    const configModal = document.getElementById('config-modal');
    const configModalClose = document.getElementById('config-modal-close');
    const configModalCancel = document.getElementById('config-modal-cancel');
    const configModalOk = document.getElementById('config-modal-ok');
    
    // Fungsi untuk mengumpul semua data dari modal FiziSysMaker Preferences
    const gatherFizisysSettings = () => {
        const settings = {};
        // Gunakan ID sebenar dari HTML (dengan sempang)
        const settingIds = [
            'check-updates', 'autosave-interval', 'show-begin-box', 'doc-root',
            'base-url', 'field-default-type', 'field-default-length', 'table-suggest-icon',
            'table-allow-csv', 'table-dv-separate-page', 'table-hide-save-as-copy',
            'table-allow-add-from-homepage', 'table-show-record-count', 'project-encoding',
            'project-rtl', 'project-doxygen', 'project-hide-footer', 'max-entries', 'project-no-trim'
        ];

        settingIds.forEach(id => {
            const element = document.getElementById(`fizisys-${id}`);
            if (element) {
                // Tukar ID kepada nama lajur DB (dengan garis bawah)
                const settingKey = id.replace(/-/g, '_');
                if (element.type === 'checkbox') {
                    settings[settingKey] = element.checked ? '1' : '0';
                } else {
                    settings[settingKey] = element.value;
                }
            }
        });
        
        const fontSize = document.querySelector('input[name="fizisys-font-size"]:checked');
        if (fontSize) {
            settings.font_size = fontSize.value;
        }
        
        return settings;
    };
    
    if (configBtn) {
        configBtn.addEventListener('click', async () => {
            await populateSettingsModal();
            configModal?.classList.remove('hidden');
        });
    }

    const closeModal = () => configModal?.classList.add('hidden');

    if (configModalClose) configModalClose.addEventListener('click', closeModal);
    if (configModalCancel) configModalCancel.addEventListener('click', closeModal);

    if (configModalOk) {
        configModalOk.addEventListener('click', async () => {
            const settingsData = gatherFizisysSettings();
            const result = await window.electronAPI.saveAllSettings(settingsData);
            
            if (result.success) {
                applyFontSize(settingsData.font_size); 
                showCustomDialog({ title: "Success", message: "Preferences have been saved." });
            } else {
                showCustomDialog({ title: "Error", message: `Failed to save preferences: ${result.message}` });
            }
            
            closeModal();
        });
    }
}

export function initializeMediaTabHandlers() {
    const mediaRadios = document.querySelectorAll('input[name="fld-media-type"]');
    const allPanels = document.querySelectorAll('.media-options-panel');

    if (mediaRadios.length === 0) return;

    mediaRadios.forEach(radio => {
        radio.addEventListener('click', () => {
            // 1. Sembunyikan semua panel terlebih dahulu
            allPanels.forEach(panel => panel.classList.add('hidden'));

            // 2. Tentukan ID panel yang sepadan
            const radioValue = radio.value; // cth: "link", "image", "upload"
            let targetPanelId;

            // Kendalikan kes khas untuk 'File upload'
            if (radioValue === 'upload') {
                targetPanelId = 'file-upload-options-panel';
            } else {
                targetPanelId = `${radioValue}-options-panel`;
            }

            // 3. Cari dan paparkan panel sasaran
            const targetPanel = document.getElementById(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.remove('hidden');
            }
        });
    });
}

/**
 * Memastikan tab Media mempunyai keadaan lalai yang bersih apabila dibuka.
 * Fungsi ini dipanggil dari sidebar.js apabila pengguna mengklik pada medan.
 */
export function setupMediaTab(tableName, fieldName) {
    // Isi dropdown 'The other field' untuk kedua-dua panel Link dan File
    populateOtherFieldDropdown(tableName, fieldName);
    populateFileOtherFieldDropdown(tableName, fieldName);

    // Sembunyikan panel bersyarat secara lalai
    const gmapDetails = document.getElementById('gmap-details');
    const youtubeDetails = document.getElementById('youtube-details');
    if (gmapDetails) gmapDetails.classList.add('hidden');
    if (youtubeDetails) youtubeDetails.classList.add('hidden');

}

export function initializeOptionsListHandlers() {
    const quickListSelect = document.getElementById('options-quick-list');
    const valuesInput = document.getElementById('fld-options-list-values');

    if (quickListSelect && valuesInput) {
        quickListSelect.addEventListener('change', () => {
            if (quickListSelect.value) {
                // 1. Tetapkan nilai textbox seperti biasa
                valuesInput.value = quickListSelect.value;
                
                // 2. ▼▼▼ BARIS KOD KRITIKAL ▼▼▼
                // Cetuskan acara 'input' secara manual untuk memaklumkan SaveManager
                valuesInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }
}

export function initializeLocalizationHandlers() {
    const dateOrderSelect = document.getElementById('app-date-order');
    const separatorSelect = document.getElementById('app-separator');
    const use24hrCheckbox = document.getElementById('app-use-24hr-format');
    const previewInput = document.getElementById('app-date-preview');

    // Pastikan semua elemen wujud sebelum meneruskan
    if (!dateOrderSelect || !separatorSelect || !use24hrCheckbox || !previewInput) {
        console.warn("Localization handler elements not found. Skipping initialization.");
        return;
    }

    const updateDateTimePreview = () => {
        const order = dateOrderSelect.value;
        const separator = separatorSelect.value;
        const is24hr = use24hrCheckbox.checked;

        // Gunakan tarikh dan masa yang tetap untuk pratonton
        const year = "2022";
        const month = "12";
        const day = "31";
        const time = is24hr ? "22:15" : "10:15 PM";

        let dateString;
        switch (order) {
            case 'ymd':
                dateString = `${year}${separator}${month}${separator}${day}`;
                break;
            case 'dmy':
                dateString = `${day}${separator}${month}${separator}${year}`;
                break;
            case 'mdy':
            default:
                dateString = `${month}${separator}${day}${separator}${year}`;
                break;
        }

        // Kemas kini nilai medan pratonton
        previewInput.value = `${dateString} ${time}`;
    };

    // Panggil fungsi apabila mana-mana kawalan diubah
    dateOrderSelect.addEventListener('change', updateDateTimePreview);
    separatorSelect.addEventListener('change', updateDateTimePreview);
    use24hrCheckbox.addEventListener('change', updateDateTimePreview);

    // Panggil sekali semasa muat untuk menetapkan nilai awal
    updateDateTimePreview();
}

function updatePreviewImage() {
    const themeSelect = document.getElementById('app-theme-select');
    const previewImage = document.getElementById('theme-preview-image');
    const selectedViewRadio = document.querySelector('input[name="view_mode"]:checked');

    // Pastikan semua elemen wujud
    if (!themeSelect || !previewImage || !selectedViewRadio) {
        console.warn("Theme preview elements not found.");
        return;
    }

    const theme = themeSelect.value; // cth: "bootstrap", "darkly"
    const viewMode = selectedViewRadio.value === 'table_view' ? 'TV' : 'DV'; // Tukar kepada 'TV' atau 'DV'

    // Bina nama fail imej yang baharu
    previewImage.src = `images/northwind-${theme}-${viewMode}.png`;
}

export function initializeThemeHandlers() {
    const themeSelect = document.getElementById('app-theme-select');
    const viewModeRadios = document.querySelectorAll('input[name="view_mode"]');

    if (themeSelect) {
        themeSelect.addEventListener('change', updatePreviewImage);
    }

    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', updatePreviewImage);
    });

    // Panggil sekali untuk tetapkan imej yang betul semasa aplikasi dimuatkan
    updatePreviewImage();
}

export function initializeSecurityTabHandlers() {
    const openBrowserBtn = document.getElementById('open-browser-btn');
    const appUrlInput = document.getElementById('app-url');

    const hideLoginCheckbox = document.getElementById('app-hide_login');

    if (hideLoginCheckbox) {
        hideLoginCheckbox.addEventListener('change', () => {
            if (hideLoginCheckbox.checked) {
                const message = "This will hide the 'Sign in' links and any membership features from visitors. " +
                    "However, you might still need to log in to the admin area to set the desired " +
                    "permissions for anonymous users. This is necessary sometimes when visitors " +
                    "are unable to access some tables.";
                showCustomDialog({ title: "Important Note!", message: message });
            }
        });
    }
	
    if (!openBrowserBtn || !appUrlInput) {
        console.warn("Security tab elements not found. Skipping initialization.");
        return;
    }

    openBrowserBtn.addEventListener('click', () => {
        const url = appUrlInput.value.trim();

        // Pastikan URL tidak kosong sebelum cuba membukanya
        if (url) {
            // Panggil fungsi yang didedahkan oleh preload.js
            window.electronAPI.openUrl(url);
        } else {
                showCustomDialog({
                    title: "Input Error",
                    message: "Application URL is empty."
                });
        }
    });
}

export function initializeClassSelectorHandlers() {
    // Kumpulan untuk Table View
    const tvSelect = document.getElementById('table-view-classes-select');
    const tvInput = document.getElementById('tbl-table-view-classes-input');

    // Kumpulan untuk Detail View
    const dvSelect = document.getElementById('detail-view-classes-select');
    const dvInput = document.getElementById('tbl-detail-view-classes-input');

    if (tvSelect && tvInput) {
        tvSelect.addEventListener('change', () => {
            tvInput.value = tvSelect.value;
            // ▼▼▼ KEMAS KINI: Cetuskan event 'input' secara manual ▼▼▼
            tvInput.dispatchEvent(new Event('input', { bubbles: true }));
            // ▲▲▲ TAMAT KEMAS KINI ▲▲▲
        });
    }

    if (dvSelect && dvInput) {
        dvSelect.addEventListener('change', () => {
            dvInput.value = dvSelect.value;
            // ▼▼▼ KEMAS KINI: Cetuskan event 'input' secara manual ▼▼▼
            dvInput.dispatchEvent(new Event('input', { bubbles: true }));
            // ▲▲▲ TAMAT KEMAS KINI ▲▲▲
        });
    }
}

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

export function initializeAutoDefaultHandlers() {
    const autoDefaultBtn = document.getElementById('auto-default-btn');
    const autoDefaultModal = document.getElementById('auto-default-modal');
    const defaultValueInput = document.getElementById('fld-default-value');
    
    // Elemen di dalam modal
    const selectValue = document.getElementById('auto-default-select');
    const btnOk = document.getElementById('auto-default-ok');
    const btnCancel = document.getElementById('auto-default-cancel');
    const btnClose = document.getElementById('auto-default-close');

    if (!autoDefaultBtn || !autoDefaultModal || !defaultValueInput || !selectValue || !btnOk || !btnCancel || !btnClose) {
        console.warn("Auto-default handler elements not found. Skipping initialization.");
        return;
    }

    const closeModal = () => autoDefaultModal.classList.add('hidden');

    autoDefaultBtn.addEventListener('click', () => {
        autoDefaultModal.classList.remove('hidden');
    });

    btnOk.addEventListener('click', () => {
        // 1. Salin nilai dari dropdown modal ke textbox 'Default'
        defaultValueInput.value = selectValue.value;

        // 2. ▼▼▼ BARIS KOD TAMBAHAN (PEMBETULAN) ▼▼▼
        // Cetuskan acara 'input' untuk memaklumkan SaveManager tentang perubahan
        defaultValueInput.dispatchEvent(new Event('input', { bubbles: true }));

        // 3. Tutup modal
        closeModal();
    });

    btnCancel.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
}

export function initializeLinkOptionsHandlers() {
    const behaviorSelect = document.getElementById('fld-media-link-behavior');
    const displayAsGroup = document.getElementById('link-display-as-group');
    const displayAsSelect = document.getElementById('fld-media-link-display-as');
    const otherFieldGroup = document.getElementById('link-other-field-group');

    if (!behaviorSelect || !displayAsGroup || !displayAsSelect || !otherFieldGroup) {
        console.warn("Link options handler elements not found. Skipping initialization.");
        return;
    }

    // Listener untuk dropdown pertama: "Behavior..."
    behaviorSelect.addEventListener('change', () => {
        const value = behaviorSelect.value;
        if (value === 'web_link' || value === 'email_link') {
            displayAsGroup.classList.remove('hidden');
        } else {
            displayAsGroup.classList.add('hidden');
        }
        // Cetuskan 'change' pada dropdown kedua untuk memastikan keadaannya betul
        displayAsSelect.dispatchEvent(new Event('change'));
    });

    // Listener untuk dropdown kedua: "Display the link..."
    displayAsSelect.addEventListener('change', () => {
        // Hanya paparkan jika dropdown pertama membenarkannya
        if (!displayAsGroup.classList.contains('hidden') && displayAsSelect.value === 'other_field') {
            otherFieldGroup.classList.remove('hidden');
        } else {
            otherFieldGroup.classList.add('hidden');
        }
    });
}

function populateOtherFieldDropdown(tableName, currentFieldName) {
    const otherFieldSelect = document.getElementById('fld-media-link-other-field');
    if (!otherFieldSelect || !jsonData) return;

    // Kosongkan senarai sedia ada
    otherFieldSelect.innerHTML = '';

    const table = jsonData.database.table[tableName];
    if (table && table.fields) {
        // Dapatkan semua nama medan dan tapis keluar medan semasa
        const otherFields = Object.keys(table.fields).filter(f => f !== currentFieldName);

        otherFields.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            otherFieldSelect.appendChild(option);
        });
    }
}

export function initializeImageOptionsHandlers() {
    const mainCheckbox = document.getElementById('fld-allow-image-uploads');
    const imageOptionsTabs = document.getElementById('image-options-tabs');

    const dependentControls = [
        document.getElementById('fld-max-file-size'),
        document.getElementById('fld-delete-image-server'),
        document.getElementById('fld-dont-rename-image'),
        document.getElementById('fld-tv-thumb-width'),
        document.getElementById('fld-tv-thumb-height'),
        document.getElementById('fld-tv-enable-zooming'),
        document.getElementById('fld-tv-show-full-size'),
        document.getElementById('fld-dv-thumb-width'),
        document.getElementById('fld-dv-thumb-height'),
        document.getElementById('fld-dv-enable-zooming'),
        document.getElementById('fld-dv-show-full-size')
    ];

    const tvShowFullSize = document.getElementById('fld-tv-show-full-size');
    const tvEnableZooming = document.getElementById('fld-tv-enable-zooming');
    const dvShowFullSize = document.getElementById('fld-dv-show-full-size');
    const dvEnableZooming = document.getElementById('fld-dv-enable-zooming');

    const toggleImageOptions = () => {
        const isEnabled = mainCheckbox.checked;
        imageOptionsTabs.classList.toggle('hidden', !isEnabled);
        dependentControls.forEach(control => {
            if (control) control.disabled = !isEnabled;
        });
        if(isEnabled) {
             handleZoomDependency();
        }
    };

    // ▼▼▼ KEMAS KINI FUNGSI INI ▼▼▼
    const handleZoomDependency = () => {
        if (tvShowFullSize && tvEnableZooming) {
            const isDisabled = tvShowFullSize.checked;
            tvEnableZooming.disabled = isDisabled;
            // Jika ia dinyahaktifkan, pastikan ia juga dinyah-tanda
            if (isDisabled) {
                tvEnableZooming.checked = false;
            }
        }
        if (dvShowFullSize && dvEnableZooming) {
            const isDisabled = dvShowFullSize.checked;
            dvEnableZooming.disabled = isDisabled;
            // Jika ia dinyahaktifkan, pastikan ia juga dinyah-tanda
            if (isDisabled) {
                dvEnableZooming.checked = false;
            }
        }
    };

    if (mainCheckbox) {
        mainCheckbox.addEventListener('change', toggleImageOptions);
    }
    if (tvShowFullSize) {
        tvShowFullSize.addEventListener('change', handleZoomDependency);
    }
    if (dvShowFullSize) {
        dvShowFullSize.addEventListener('change', handleZoomDependency);
    }
    
    if(mainCheckbox) {
        toggleImageOptions();
    }
}
function populateFileOtherFieldDropdown(tableName, currentFieldName) {
    const otherFieldSelect = document.getElementById('fld-file-other-field');
    if (!otherFieldSelect || !jsonData) return;

    otherFieldSelect.innerHTML = '';
    const table = jsonData.database.table[tableName];
    if (table && table.fields) {
        const otherFields = Object.keys(table.fields).filter(f => f !== currentFieldName);
        otherFields.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            otherFieldSelect.appendChild(option);
        });
    }
}

export function initializeFileUploadOptionsHandlers() {
    // --- Bahagian 1: Logik Checkbox Utama ---
    const mainCheckbox = document.getElementById('fld-allow-file-uploads');
    const dependentControls = [
        document.getElementById('fld-file-types'),
        document.getElementById('fld-file-max-size'),
        document.getElementById('fld-delete-file-server'),
        document.getElementById('fld-dont-rename-file'),
        document.getElementById('fld-file-behavior'),
        document.getElementById('fld-file-display-as'),
        document.getElementById('fld-file-other-field')
    ];

    // --- Bahagian 2: Logik Dropdown Bersyarat ---
    const behaviorSelect = document.getElementById('fld-file-behavior');
    // Tetapkan 'Download link' sebagai nilai lalai
    if (behaviorSelect) {
        behaviorSelect.value = 'download_link';
    }
    const displayAsGroup = document.getElementById('fld-file-display-as-group');
    const displayAsSelect = document.getElementById('fld-file-display-as');
    const otherFieldGroup = document.getElementById('fld-file-other-field-group');

    const toggleAllOptions = () => {
        const isEnabled = mainCheckbox.checked;
        dependentControls.forEach(control => {
            if (control) control.disabled = !isEnabled;
        });
        // Cetuskan event pada dropdown untuk reset keadaan paparannya
        if (behaviorSelect) behaviorSelect.dispatchEvent(new Event('change'));
    };

    if (mainCheckbox) {
        mainCheckbox.addEventListener('change', toggleAllOptions);
    }

    // Pasang listener untuk dropdown bersyarat
    if (behaviorSelect) {
        behaviorSelect.addEventListener('change', () => {
            if (behaviorSelect.value === 'download_link') {
                displayAsGroup.classList.remove('hidden');
            } else {
                displayAsGroup.classList.add('hidden');
            }
            if (displayAsSelect) displayAsSelect.dispatchEvent(new Event('change'));
        });
    }

    if (displayAsSelect) {
        displayAsSelect.addEventListener('change', () => {
            if (!displayAsGroup.classList.contains('hidden') && displayAsSelect.value === 'other_field') {
                otherFieldGroup.classList.remove('hidden');
            } else {
                otherFieldGroup.classList.add('hidden');
            }
        });
    }

    // Tetapkan keadaan awal semasa muat
    if (mainCheckbox) {
        toggleAllOptions();
    }
}

export function initializeMediaVisibilityHandlers() {
    // --- Pengendali untuk Google Map ---
    const gmapCheckbox = document.getElementById('fld-display-gmap');
    const gmapDetails = document.getElementById('gmap-details');

    if (gmapCheckbox && gmapDetails) {
        gmapCheckbox.addEventListener('change', () => {
            gmapDetails.classList.toggle('hidden', !gmapCheckbox.checked);
        });
    }

    // --- Pengendali untuk YouTube Video ---
    const youtubeCheckbox = document.getElementById('fld-accept-video-url');
    const youtubeDetails = document.getElementById('youtube-details');

    if (youtubeCheckbox && youtubeDetails) {
        youtubeCheckbox.addEventListener('change', () => {
            youtubeDetails.classList.toggle('hidden', !youtubeCheckbox.checked);
        });
    }
}

export function populateParentChildTab(currentTableName) {
    const childList = document.getElementById('child-table-list');
    const listPanel = childList.parentElement; 
    const optionsPanel = listPanel.nextElementSibling;
    const optionsTitle = document.getElementById('selected-child-table-name');
    const formElements = {
        showTab: document.getElementById('parentchild-show-tab'),
        showIcon: document.getElementById('parentchild-show-icon'),
        autocloseModal: document.getElementById('parentchild-autoclose-modal'),
        tabTitle: document.getElementById('parentchild-tab-title'),
        copyRecords: document.getElementById('parentchild-copy-records'),
        showLinkAbove: document.getElementById('parentchild-show-link-above'),
        showCount: document.getElementById('parentchild-show-count-in-tv'),
        allowAdd: document.getElementById('parentchild-allow-add-from-tv')
    };
    
    if (!childList || !jsonData.database.relationships || !optionsPanel) return;

    const children = jsonData.database.relationships.filter(
        rel => rel.parent_table_name === currentTableName
    );

    childList.innerHTML = '';

    if (children.length === 0) {
        optionsPanel.classList.add('hidden');
        const emptyMessage = `
            <div class="empty-state-label" style="padding: 1rem; text-align: left;">
                <p style="text-align: center; font-weight: 500;">This table has no child tables.</p>
                <span style="display: block; text-align: center; margin-top: 0.5rem; font-size: 0.85em;">
                    To create a relationship, select the foreign key field in the side menu and set the 'Parent table' in the 'Lookup field' tab.
                </span>
            </div>
        `;
        childList.innerHTML = emptyMessage;
    } else {
        optionsPanel.classList.remove('hidden');
        Object.values(formElements).forEach(el => el.type === 'checkbox' ? el.checked = false : el.value = '');
        optionsTitle.textContent = '...';

        children.forEach(child => {
            const li = document.createElement('li');
            li.textContent = child.child_table_name;
            li.dataset.childName = child.child_table_name; // Pastikan dataset ini wujud
            childList.appendChild(li);
        });
        
        const populateForm = (childName) => {
            const relationData = children.find(c => c.child_table_name === childName);
            if (!relationData) return;
            optionsTitle.textContent = childName;
            formElements.showTab.checked = relationData.show_tab === 1;
            formElements.showIcon.checked = relationData.show_icon === 1;
            formElements.autocloseModal.checked = relationData.autoclose_modal === 1;
            formElements.tabTitle.value = relationData.tab_title || '';
            formElements.copyRecords.checked = relationData.copy_records === 1;
            formElements.showLinkAbove.checked = relationData.show_link_above === 1;
            formElements.showCount.checked = relationData.show_count_in_tv === 1;
            formElements.allowAdd.checked = relationData.allow_add_from_tv === 1;
        };

        // Elakkan menambah event listener berulang kali
        const newChildList = childList.cloneNode(true);
        childList.parentNode.replaceChild(newChildList, childList);

        newChildList.addEventListener('click', (event) => {
            if (event.target.tagName === 'LI') {
                newChildList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
                event.target.classList.add('active');
                populateForm(event.target.dataset.childName);
            }
        });

        const itemToSelect = newChildList.querySelector(`li[data-child-name="${lastActiveChildTable}"]`);

        if (itemToSelect) {
            itemToSelect.click();
        } else if (newChildList.firstChild && newChildList.firstChild.tagName === 'LI') {
            newChildList.firstChild.click();
        }
        
        // ▼▼▼ KEMAS KINI: Baris kod di bawah ini telah dibuang ▼▼▼
        // setLastActiveChildTable(null); 
        // ▲▲▲ TAMAT KEMAS KINI ▲▲▲
    }
}

export function populateMainDashboard(projectData) {
    if (!projectData) {
        console.warn("Tiada data projek untuk dipaparkan di papan pemuka.");
        return;
    }

    // Tab: Localization
    setElementValue('app-title', projectData.app_title);
    setElementValue('app-date-order', projectData.date_order);
    setElementValue('app-separator', projectData.separator);
    setElementValue('app-char-encoding', projectData.char_encoding);
    setElementValue('app-language-select', projectData.language_select);
    setElementValue('app-timezone-select', projectData.timezone_select);
    setElementValue('app-use-24hr-format', projectData.use_24hr_format);
    setElementValue('app-enforce_mysql_encoding', projectData.enforce_mysql_encoding);
    
    // Tab: Theme
    setElementValue('app-theme-select', projectData.theme_select);
    setElementValue('app-use_3d_effects', projectData.use_3d_effects);
    setElementValue('app-rtl', projectData.rtl);
    setElementValue('app-compact', projectData.compact);
    
    // Tab: Menu management
    setRadioValue('app-menu_orientation', projectData.menu_orientation);
    setElementValue('app-menu_at_homepage', projectData.menu_at_homepage);
    setElementValue('app-tables-per-row', projectData.tables_per_row);
    setRadioValue('app-extra-wide', projectData.extra_wide);
    setElementValue('app-panel-height', projectData.panel_height);
    
    // Tab: Security & technical
    setElementValue('app-hide_login', projectData.hide_login);
    setElementValue('app-allow_sql_tool', projectData.allow_sql_tool);
    setElementValue('app-allow_server_status', projectData.allow_server_status);
    setElementValue('app-admins_group_access', projectData.admins_group_access);
    setElementValue('app-allow_table_view_sql', projectData.allow_table_view_sql);
    setElementValue('app-copy_children_async', projectData.copy_children_async);
    setElementValue('app-allow_pwa_install', projectData.allow_pwa_install);
    setElementValue('app-url', projectData.url);
    setElementValue('app-hook-logic', projectData.project_hook_workflow); // Populate workflow data
    
    // Cetuskan event untuk kemas kini pratonton yang bergantung pada nilai ini
    document.getElementById('app-date-order')?.dispatchEvent(new Event('change'));
    document.getElementById('app-theme-select')?.dispatchEvent(new Event('change'));
	
    const menuCheckbox = document.getElementById('app-menu_at_homepage');
    if (menuCheckbox) {
        menuCheckbox.dispatchEvent(new Event('change'));
    }
}

export function populateTableSettings(tableName) {

    populateSortByDropdown(tableName);
    populateFocusFieldDropdown(tableName);
    populateRecordOwnerDropdown(tableName);
		
    const tableData = jsonData.database.table[tableName];
    if (!tableData) {
        console.error(`Tiada data ditemui untuk jadual: ${tableName}`);
        return;
    }
	
    setElementValue('tbl-table-name', tableData.table_name);
    // Tab: Table view -> General
    setElementValue('tbl-table-view-title', tableData.table_view_title);
    setElementValue('tbl-table-description', tableData.table_description);

    // Tab: Table view -> Display & Data
    setElementValue('tbl-show-quick-search', tableData.show_quick_search);
    setElementValue('tbl-records-per-page', tableData.records_per_page);
    setElementValue('tbl-default-sort-by', tableData.default_sort_by);
    setElementValue('tbl-sort-descending', tableData.sort_descending);

    // Tab: Table view -> Permissions
    setElementValue('tbl-allow-sorting', tableData.allow_sorting);
    setElementValue('tbl-allow-filters', tableData.allow_filters);
    setElementValue('tbl-allow-csv-export', tableData.allow_csv_export);
    setElementValue('tbl-allow-print-view', tableData.allow_print_view);
    setElementValue('tbl-allow-user-save-filters', tableData.allow_user_save_filters);
    setElementValue('tbl-hide-homepage-link', tableData.hide_homepage_link);
    setElementValue('tbl-allow-mass-delete', tableData.allow_mass_delete);
    setElementValue('tbl-filter-before-view', tableData.filter_before_view);
    setElementValue('tbl-hide-nav-menu-link', tableData.hide_nav_menu_link);
    setElementValue('tbl-show-record-count', tableData.show_record_count);

    // Tab: Table view -> Template
    setElementValue('tbl-tv-template', tableData.tv_template);
    setElementValue('tbl-hide-field-captions', tableData.hide_field_captions);
    setElementValue('tbl-use-first-field-as-title', tableData.use_first_field_as_title);
    setElementValue('tbl-table-view-classes-input', tableData.table_view_classes_input);
    setElementValue('tbl-detail-view-classes-input', tableData.detail_view_classes_input);
    
    // Tab: Detail View -> General
    setElementValue('tbl-detail-view-title', tableData.detail_view_title);
    setElementValue('tbl-record-owner', tableData.record_owner);
    setElementValue('tbl-default-focus', tableData.default_focus);
    setElementValue('tbl-redirect-after-insert', tableData.redirect_after_insert);

    // Tab: Detail View -> Permissions
    setElementValue('tbl-enable-detail-view', tableData.enable_detail_view);
    setElementValue('tbl-delete-with-children', tableData.delete_with_children);
    setElementValue('tbl-dv-allow-print-view', tableData.dv_allow_print_view);
    setElementValue('tbl-dv-separate-page', tableData.dv_separate_page);
    setElementValue('tbl-dv-hide-save-as-copy', tableData.dv_hide_save_as_copy);
    setElementValue('tbl-dv-sticky-buttons', tableData.dv_sticky_buttons);
    setElementValue('tbl-dv-allow-add-from-homepage', tableData.dv_allow_add_from_homepage);
    setElementValue('tbl-hook-logic', tableData.table_hook_workflow); // Populate workflow data
	
    const tvClassesInput = document.getElementById('tbl-table-view-classes-input');
    const tvClassesSelect = document.getElementById('table-view-classes-select');
    if (tvClassesInput && tvClassesSelect) {
        tvClassesSelect.value = tvClassesInput.value;
    }

    const dvClassesInput = document.getElementById('tbl-detail-view-classes-input');
    const dvClassesSelect = document.getElementById('detail-view-classes-select');
    if (dvClassesInput && dvClassesSelect) {
        dvClassesSelect.value = dvClassesInput.value;
	}
	
	updateTableViewTemplatePreview();
}

/**
 * Mengisi dropdown 'Parent table' dengan semua jadual lain dalam projek.
 * @param {string} currentTableName - Nama jadual semasa, untuk dikecualikan.
 */
function populateParentTableDropdown(currentTableName) {
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    parentTableSelect.innerHTML = '<option value=""></option>'; // Kosongkan dan tambah opsyen lalai

    const otherTables = allTableNames.filter(name => name !== currentTableName);
    otherTables.forEach(tableName => {
        const option = document.createElement('option');
        option.value = tableName;
        option.textContent = tableName;
        parentTableSelect.appendChild(option);
    });
}

export function populateFieldSettings(tableName, fieldName) {
	
    const allFieldPageControls = document.querySelectorAll(
        '#field-settings-page input, #field-settings-page select, #field-settings-page textarea, #field-settings-page button'
    );
    allFieldPageControls.forEach(control => {
        control.disabled = false;
    });
	
    const fieldData = jsonData.database.table[tableName]?.fields[fieldName];
     // ▼▼▼ CHECKPOINT #3: DATA SELEPAS DITERIMA DI FRONTEND ▼▼▼
    //console.log(`--- CHECKPOINT 3 (uiHandlers.js): Data Untuk Medan ${tableName}.${fieldName} ---`);
    //console.log(fieldData);
    // ▲▲▲ TAMAT CHECKPOINT #3 ▲▲▲   
    //console.log(`Mempaparkan data untuk medan: ${tableName}.${fieldName}`, fieldData);

    if (!fieldData) {
        console.error(`Tiada data ditemui untuk medan: ${tableName}.${fieldName}`);
        return;
    }
    populateParentTableDropdown(tableName);
	
	setElementValue('fld-field-name', fieldData.field_name);
    // Tab: General
    setElementValue('fld-caption', fieldData.caption);
    setElementValue('fld-description', fieldData.description);
    setElementValue('fld-data-type', fieldData.data_type);
    setElementValue('fld-length', fieldData.length);
	setElementValue('fld-precision', fieldData.precision);
    setElementValue('fld-max-chars-in-tv', fieldData.max_chars_in_tv);
    setElementValue('fld-alignment', fieldData.alignment);
    setElementValue('fld-default-value', fieldData.default_value);
    setElementValue('fld-read-only', fieldData.read_only);
    setElementValue('fld-primary-key', fieldData.primary_key);
    setElementValue('fld-zero-fill', fieldData.zero_fill);
    setElementValue('fld-required', fieldData.required);
    setElementValue('fld-rich-html', fieldData.rich_html);
    setElementValue('fld-auto-increment', fieldData.auto_increment);
    setElementValue('fld-unique', fieldData.unique);
    setElementValue('fld-show-sum', fieldData.show_sum);
    setElementValue('fld-text-area', fieldData.text_area);
    setElementValue('fld-unsigned', fieldData.unsigned);
    setElementValue('fld-no-filter', fieldData.no_filter);
    setElementValue('fld-binary', fieldData.binary);
    setElementValue('fld-check-box', fieldData.check_box);
    setElementValue('fld-hide-in-tv', fieldData.hide_in_tv);
    setElementValue('fld-hide-in-dv', fieldData.hide_in_dv);
    setElementValue('fld-enable-column-width', fieldData.enable_column_width);
    setElementValue('fld-column-width', fieldData.column_width);

    // Tab: Media
    const mediaType = fieldData.media_type || 'link';
    setRadioValue('fld-media-type', mediaType);
    document.getElementById(`fld-media-${mediaType}`)?.dispatchEvent(new Event('click'));
    setElementValue('fld-media-link-behavior', fieldData.media_link_behavior);
    setElementValue('fld-media-link-display-as', fieldData.media_link_display_as);
    setElementValue('fld-media-link-other-field', fieldData.media_link_other_field);
    setElementValue('fld-allow-image-uploads', fieldData.allow_image_uploads);
    setElementValue('fld-max-file-size', fieldData.max_file_size);
    setElementValue('fld-delete-image-server', fieldData.delete_image_server);
    setElementValue('fld-dont-rename-image', fieldData.dont_rename_image);
    setElementValue('fld-tv-thumb-width', fieldData.tv_thumb_width);
    setElementValue('fld-tv-thumb-height', fieldData.tv_thumb_height);
    setElementValue('fld-tv-enable-zooming', fieldData.tv_enable_zooming);
    setElementValue('fld-tv-show-full-size', fieldData.tv_show_full_size);
    setElementValue('fld-dv-thumb-width', fieldData.dv_thumb_width);
    setElementValue('fld-dv-thumb-height', fieldData.dv_thumb_height);
    setElementValue('fld-dv-enable-zooming', fieldData.dv_enable_zooming);
    setElementValue('fld-dv-show-full-size', fieldData.dv_show_full_size);
    document.getElementById('fld-allow-image-uploads')?.dispatchEvent(new Event('change'));
    setElementValue('fld-allow-file-uploads', fieldData.allow_file_uploads);
    setElementValue('fld-file-types', fieldData.file_types);
    setElementValue('fld-file-max-size', fieldData.file_max_size);
    setElementValue('fld-delete-file-server', fieldData.delete_file_server);
    setElementValue('fld-dont-rename-file', fieldData.dont_rename_file);
    setElementValue('fld-file-behavior', fieldData.file_behavior);
    setElementValue('fld-file-display-as', fieldData.file_display_as);
    setElementValue('fld-file-other-field', fieldData.file_other_field);
    document.getElementById('fld-allow-file-uploads')?.dispatchEvent(new Event('change'));
    setElementValue('fld-display-gmap', fieldData.display_gmap);
    setRadioValue('fld-gmap-type', fieldData.gmap_type);
    setElementValue('fld-gmap-tv-width', fieldData.gmap_tv_width);
    setElementValue('fld-gmap-tv-height', fieldData.gmap_tv_height);
    setElementValue('fld-gmap-dv-height', fieldData.gmap_dv_height);
    document.getElementById('fld-display-gmap')?.dispatchEvent(new Event('change'));
    setElementValue('fld-accept-video-url', fieldData.accept_video_url);
    setElementValue('fld-youtube-tv-width', fieldData.youtube_tv_width);
    setElementValue('fld-youtube-tv-height', fieldData.youtube_tv_height);
    setElementValue('fld-youtube-dv-width', fieldData.youtube_dv_width);
    setElementValue('fld-youtube-dv-height', fieldData.youtube_dv_height);
    document.getElementById('fld-accept-video-url')?.dispatchEvent(new Event('change'));

    // Tab: Lookup field
    setElementValue('fld-lookup-parent-table', fieldData.lookup_parent_table);
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    if (parentTableSelect) {
        parentTableSelect.dispatchEvent(new Event('change'));
    }
    setElementValue('fld-lookup-caption-1', fieldData.lookup_caption_1);
    setElementValue('fld-lookup-separator', fieldData.lookup_separator);
    setElementValue('fld-lookup-caption-2', fieldData.lookup_caption_2);
    setRadioValue('fld-lookup-display-as', fieldData.lookup_display_as);
    setElementValue('fld-lookup-inherit-permissions', fieldData.lookup_inherit_permissions);
    setElementValue('fld-lookup-link-behavior', fieldData.lookup_link_behavior);
    setElementValue('fld-lookup-custom-query-hidden', fieldData.lookup_custom_query);

    if (parentTableSelect && !parentTableSelect.value) {
        const relationship = jsonData.database.relationships.find(rel =>
            rel.child_table_name === tableName && rel.fk_child_field === fieldName
        );
        if (relationship) {
            const parentTable = relationship.parent_table_name;
            const parentPKField = relationship.parent_field;
            setElementValue('fld-lookup-parent-table', parentTable);
            parentTableSelect.dispatchEvent(new Event('change'));
            const parentTableFields = jsonData.database.table[parentTable]?.fields;
            if (parentTableFields) {
                const fieldNames = Object.keys(parentTableFields);
                const pkIndex = fieldNames.indexOf(parentPKField);
                if (pkIndex > -1 && pkIndex < fieldNames.length - 1) {
                    const nextFieldName = fieldNames[pkIndex + 1];
                    setElementValue('fld-lookup-caption-1', nextFieldName);
                }
            }
        }
    }

    // Tab: Options list
    setElementValue('fld-options-list-values', fieldData.options_list_values);
    setRadioValue('fld-options-display', fieldData.options_display);

    // ▼▼▼ KOD PEMBAIKAN BUG ADA DI SINI ▼▼▼
    const quickListSelect = document.getElementById('options-quick-list');
    if (quickListSelect) {
        const currentValue = fieldData.options_list_values || '';
        let matchFound = false;
        // Cari jika nilai semasa sepadan dengan mana-mana opsyen dalam "Quick List!"
        for (const option of quickListSelect.options) {
            if (option.value === currentValue) {
                option.selected = true;
                matchFound = true;
                break;
            }
        }
        // Jika tiada padanan, pastikan opsyen lalai "Quick List!" dipilih
        if (!matchFound) {
            quickListSelect.value = '';
        }
    }
    // ▲▲▲ TAMAT PEMBAIKAN BUG ▲▲▲

    // Tab: Data format
    setElementValue('fld-format-as', fieldData.format_as);

    // Tab: Calculated field
    setElementValue('fld-calculated-enable', fieldData.calculated_enable);
    setElementValue('fld-calculated-query', fieldData.calculated_query);
	
	// Tab: Algorithm field
	setElementValue('fld-algorithm-enable', fieldData.algorithm_enable);
	setElementValue('fld-algorithm-logic', fieldData.algorithm_logic);
	
	// ▼▼▼ KOD PEMBETULAN: Cetuskan event 'change' secara manual ▼▼▼
	// Ini memastikan UI builder dipaparkan jika 'algorithm_enable' adalah benar.
	const algorithmEnableCheckbox = document.getElementById('fld-algorithm-enable');
	if (algorithmEnableCheckbox) {
		algorithmEnableCheckbox.dispatchEvent(new Event('change'));
	}
	// ▲▲▲ TAMAT PEMBETULAN ▲▲▲
	
	applyDataTypeRules();
	
    setTimeout(() => {
        const queryTextarea = document.getElementById('fld-calculated-query');
        if (queryTextarea) {
            queryTextarea.disabled = false;
        }
    }, 50);


    const behaviorSelect = document.getElementById('fld-media-link-behavior');
    if (behaviorSelect) {
        behaviorSelect.dispatchEvent(new Event('change'));
    }

}

/**
 * Mengisi dropdown Parent Caption (Part 1 & 2) dengan senarai medan
 * dari jadual induk yang dipilih.
 * @param {string} parentTableName - Nama jadual induk yang dipilih.
 */
function populateParentCaptionDropdowns(parentTableName) {
    const caption1Select = document.getElementById('fld-lookup-caption-1');
    const caption2Select = document.getElementById('fld-lookup-caption-2');

    // Kosongkan kedua-dua dropdown
    caption1Select.innerHTML = '<option value=""></option>';
    caption2Select.innerHTML = '<option value=""></option>';

    if (parentTableName && jsonData.database.table[parentTableName]) {
        const parentFields = Object.keys(jsonData.database.table[parentTableName].fields);
        parentFields.forEach(fieldName => {
            const option1 = document.createElement('option');
            option1.value = fieldName;
            option1.textContent = fieldName;
            caption1Select.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = fieldName;
            option2.textContent = fieldName;
            caption2Select.appendChild(option2);
        });
    }
}

export function initializeLookupFieldHandlers() {
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    const caption1Select = document.getElementById('fld-lookup-caption-1');

    if (parentTableSelect && caption1Select) {
        parentTableSelect.addEventListener('change', () => {
            const selectedTable = parentTableSelect.value;
            
            // 1. Isi dropdown caption dengan semua medan seperti biasa
            populateParentCaptionDropdowns(selectedTable);

            // ▼▼▼ LOGIK BAHARU YANG LEBIH PINTAR ▼▼▼
            if (selectedTable && jsonData.database.table[selectedTable]) {
                const parentFields = jsonData.database.table[selectedTable].fields;
                const fieldNames = Object.keys(parentFields);
                const integerTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'];

                let defaultCaptionField = null;

                // 1. Cuba cari medan BUKAN integer yang pertama
                const firstNonIntegerField = fieldNames.find(name => 
                    !integerTypes.includes(parentFields[name].data_type.toUpperCase())
                );

                if (firstNonIntegerField) {
                    defaultCaptionField = firstNonIntegerField;
                } else if (fieldNames.length > 1) {
                    // 2. Jika tiada, kembali kepada logik lama (pilih medan kedua)
                    defaultCaptionField = fieldNames[1];
                }

                // Tetapkan nilai dropdown jika medan lalai ditemui
                if (defaultCaptionField) {
                    caption1Select.value = defaultCaptionField;
                }
            }
            // ▲▲▲ TAMAT LOGIK BAHARU ▲▲▲
        });
    }
}

// uiHandlers.js

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

export function populateMenuManagement(menuGroupsData) {
    const menuGroupList = document.querySelector('.menu-group-list');
    const individualTableMenusContainer = document.getElementById('individual-table-menus');
    const customMenuListContainer = document.getElementById('custom-menu-list');

    if (!menuGroupList || !individualTableMenusContainer || !customMenuListContainer) return;

    // --- 1. Populate Group Menus (Logic sedia ada, tiada perubahan) ---
    menuGroupList.innerHTML = '';
    if (!menuGroupsData || menuGroupsData.length === 0) {
        menuGroupList.innerHTML = `<div class="empty-state-label"><p>No menu groups created.</p><span>Click 'Add Menu Group' to start.</span></div>`;
    } else {
        menuGroupsData.forEach(group => {
            const tagsHtml = group.items.map(item => `
                <span class="tag" draggable="true" data-item-id="${item.item_id}">
                    ${item.table_name} <button class="remove-tag">&times;</button>
                </span>`).join('');
            const groupElement = document.createElement('div');
            groupElement.className = 'menu-group-item';
            groupElement.setAttribute('draggable', 'true');
            groupElement.dataset.groupId = group.menu_group_id;
            groupElement.innerHTML = `
                <i class="fas fa-grip-vertical drag-handle"></i>
                <input type="text" class="group-name-input" value="${group.group_name}">
                <div class="menu-selector">${tagsHtml}<button class="add-menu-btn" title="Add menu to this group">+</button></div>
                <div class="group-actions"><button class="btn-sidebar-icon" title="Delete group"><i class="fas fa-trash-alt"></i></button></div>`;
            menuGroupList.appendChild(groupElement);
        });
    }

    // --- 2. Populate Individual Menus (Logic dikemas kini dan disahkan) ---
    individualTableMenusContainer.innerHTML = '';
    customMenuListContainer.innerHTML = '';

    const allTables = allTableNames || [];
    const groupedTables = new Set(menuGroupsData.flatMap(g => g.items.map(i => i.table_name)));
    const unassignedTables = allTables.filter(t => !groupedTables.has(t));
    const individualMenusData = jsonData.database.individual_menus || [];

    // Paparkan checkbox untuk jadual yang tidak berada dalam mana-mana kumpulan
    if (unassignedTables.length > 0) {
        unassignedTables.forEach(tableName => {
            // Semak jika jadual ini wujud dalam data menu individu (bermakna ia sepatutnya ditanda)
            const isChecked = individualMenusData.some(item => item.table_name === tableName);
            const checkboxLabel = document.createElement('label');
            checkboxLabel.className = 'checkbox-label';
            checkboxLabel.innerHTML = `<input type="checkbox" data-table-name="${tableName}" ${isChecked ? 'checked' : ''}> ${tableName}`;
            individualTableMenusContainer.appendChild(checkboxLabel);
        });
    } else {
        individualTableMenusContainer.innerHTML = `<p style="color: var(--secondary-color); font-style: italic; text-align: center;">All tables are in menu groups.</p>`;
    }

    // Tapis dan paparkan hanya item menu custom (di mana table_id adalah NULL)
    const customMenus = individualMenusData.filter(item => item.table_id === null);
    customMenus.forEach(item => {
        // Gunakan fungsi helper 'createCustomMenuItem' yang sedia ada
        const customItemEl = createCustomMenuItem(item);
        customMenuListContainer.appendChild(customItemEl);
    });
}

// js/uiHandlers.js

// Fungsi bantuan untuk menjana query lalai
function generateDefaultLookupQuery() {
    const parentTable = document.getElementById('fld-lookup-parent-table').value;
    const caption1 = document.getElementById('fld-lookup-caption-1').value;
    const caption2 = document.getElementById('fld-lookup-caption-2').value;
    const separator = document.getElementById('fld-lookup-separator').value;

    if (!parentTable || !caption1) return '';

    let captionFields = `\`${parentTable}\`.\`${caption1}\``;
    if (caption2 && separator) {
        captionFields = `CONCAT(${captionFields}, '${separator}', \`${parentTable}\`.\`${caption2}\`)`;
    }

    // Dapatkan Primary Key dari jadual induk
    const parentTableData = jsonData.database.table[parentTable];
    const pkField = Object.keys(parentTableData.fields).find(f => parentTableData.fields[f].primary_key) || 'id';

    return `SELECT \`${parentTable}\`.\`${pkField}\`, ${captionFields} FROM \`${parentTable}\` ORDER BY 2`;
}

export function initializeAdvancedLookupHandlers() {
    const modal = document.getElementById('advanced-lookup-modal');
    const openBtn = document.getElementById('fld-lookup-advanced-btn');
    const closeBtn = document.getElementById('advanced-lookup-modal-close');
    const okBtn = document.getElementById('advanced-lookup-ok-btn');
    const cancelBtn = document.getElementById('advanced-lookup-cancel-btn');
    const resetBtn = document.getElementById('advanced-lookup-reset-btn');
    const queryTextarea = document.getElementById('fld-lookup-custom-query');
    const hiddenQueryInput = document.getElementById('fld-lookup-custom-query-hidden');

    const openModal = () => {
        let currentQuery = hiddenQueryInput.value;
        if (!currentQuery) {
            currentQuery = generateDefaultLookupQuery();
        }
        queryTextarea.value = currentQuery;
        modal.classList.remove('hidden');
    };

    const closeModal = () => modal.classList.add('hidden');

    const saveAndClose = () => {
        hiddenQueryInput.value = queryTextarea.value;
        closeModal();
    };

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', saveAndClose);
    resetBtn.addEventListener('click', () => {
        queryTextarea.value = generateDefaultLookupQuery();
    });
}

export function initializeHomepageMenuHandlers() {
    const menuAtHomepageCheckbox = document.getElementById('app-menu_at_homepage');
    const dependentOptions = document.querySelectorAll('.homepage-menu-option');

    if (!menuAtHomepageCheckbox || dependentOptions.length === 0) return;

    const toggleOptionsVisibility = () => {
        const isChecked = menuAtHomepageCheckbox.checked;
        dependentOptions.forEach(option => {
            // Gunakan style.display untuk kawalan terus
            option.style.display = isChecked ? '' : 'none';
        });
    };

    // Tambah listener pada checkbox
    menuAtHomepageCheckbox.addEventListener('change', toggleOptionsVisibility);

    // Panggil sekali semasa muat untuk menetapkan keadaan awal yang betul
    toggleOptionsVisibility();
}

// js/uiHandlers.js

// Fungsi ini akan dipanggil dari populateFieldSettings juga, jadi kita letakkan di luar
function applyDataTypeRules() {
    const dataTypeSelect = document.getElementById('fld-data-type');
    if (!dataTypeSelect) return;

    const selectedType = dataTypeSelect.value;

    // Kumpulkan semua elemen yang akan dikawal
    const elements = {
		length: document.getElementById('fld-length'),
        precision: document.getElementById('fld-precision'),
        autoIncrement: document.getElementById('fld-auto-increment'),
        unsigned: document.getElementById('fld-unsigned'),
        zeroFill: document.getElementById('fld-zero-fill'),
        showSum: document.getElementById('fld-show-sum'),
        binary: document.getElementById('fld-binary'),
        mediaRadios: document.querySelectorAll('input[name="fld-media-type"]'),
        behaviorOptions: document.querySelectorAll('#fld-media-link-behavior option[value="web_link"], #fld-media-link-behavior option[value="email_link"]'),
		dbPropertiesFieldset: document.querySelector('#tab-field-general .fieldset-grid fieldset:nth-child(1)'),
        formBehaviorFieldset: document.querySelector('#tab-field-general .fieldset-grid fieldset:nth-child(2)'),
        defaultValue: document.getElementById('fld-default-value') // Tambah elemen Default Value
    };

    // 1. Reset: Aktifkan semua elemen secara lalai
    Object.values(elements).forEach(el => {
        if (el && el.forEach) {
            el.forEach(item => { item.disabled = false; item.hidden = false; });
        } else if (el) {
            el.disabled = false;
        }
    });
    elements.dbPropertiesFieldset.classList.remove('fieldset-disabled');
    elements.formBehaviorFieldset.classList.remove('fieldset-disabled');
	
    // ▼▼▼ MULA LOGIK TAMBAHAN ▼▼▼
    // Peraturan 1: Nyahaktifkan 'Length' untuk jenis data tertentu
    const typesWithoutLength = ['TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB'];
    if (typesWithoutLength.includes(selectedType.toUpperCase())) {
        if (elements.length) {
            elements.length.disabled = true;
            elements.length.value = ''; // Kosongkan nilai jika ada
        }
    }

    // Peraturan 2: Nyahaktifkan 'Default Value' jika 'Auto Increment' aktif
    if (elements.autoIncrement && elements.defaultValue) {
        if (elements.autoIncrement.checked) {
            elements.defaultValue.disabled = true;
            elements.defaultValue.value = ''; // Kosongkan nilai jika ada
        }
    }
    // ▲▲▲ TAMAT LOGIK TAMBAHAN ▲▲▲
	
    // 2. Kumpulan Data Type
    const numericAndDate = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'];
    const integerOnly = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'];
    const floatOnly = ['FLOAT', 'DOUBLE', 'DECIMAL'];
    const dateOnly = ['DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'];
    const binaryString = ['CHAR', 'VARCHAR', 'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB'];
    const textOnly = ['TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT'];

    // 3. Laksanakan Peraturan
    if (numericAndDate.includes(selectedType)) {
        elements.mediaRadios.forEach(radio => { if (radio.value !== 'link') radio.disabled = true; });
        elements.behaviorOptions.forEach(opt => opt.hidden = true);
    }
    if (integerOnly.includes(selectedType)) {
        if (elements.binary) elements.binary.disabled = true;
        if (elements.precision) elements.precision.disabled = true;
    }
    if (floatOnly.includes(selectedType)) {
        if (elements.binary) elements.binary.disabled = true;
        if (elements.autoIncrement) elements.autoIncrement.disabled = true;
        if (elements.precision) elements.precision.disabled = false; // Pastikan ia enabled
    }
    if (dateOnly.includes(selectedType)) {
        if (elements.autoIncrement) elements.autoIncrement.disabled = true;
        if (elements.unsigned) elements.unsigned.disabled = true;
        if (elements.zeroFill) elements.zeroFill.disabled = true;
        if (elements.showSum) elements.showSum.disabled = true;
        if (elements.binary) elements.binary.disabled = true;
        if (elements.precision) elements.precision.disabled = true;
    }
    if (binaryString.includes(selectedType) || textOnly.includes(selectedType)) {
        if (elements.autoIncrement) elements.autoIncrement.disabled = true;
        if (elements.unsigned) elements.unsigned.disabled = true;
        if (elements.zeroFill) elements.zeroFill.disabled = true;
        if (elements.showSum) elements.showSum.disabled = true;
        if (elements.precision) elements.precision.disabled = true;
    }
     if (binaryString.includes(selectedType)) {
         if (elements.binary) elements.binary.disabled = true;
     }
	 
    if (selectedType === 'VARCHAR') {
        if (!elements.length.value) elements.length.value = 255;
    }
    if (selectedType === 'INT') {
        elements.unsigned.checked = true;
    }
    if (selectedType === 'DECIMAL') {
        if (!elements.length.value) elements.length.value = 10;
        if (!elements.precision.value) elements.precision.value = 2;
    }
	
    // Logik untuk menyahaktifkan fieldset
    if (textOnly.includes(selectedType) || binaryString.includes(selectedType)) {
        if(selectedType !== 'CHAR' && selectedType !== 'VARCHAR') {
             elements.dbPropertiesFieldset.classList.add('fieldset-disabled');
        }
    }
	
    const multiSelectRadio = document.querySelector('input[name="fld-options-display"][value="multi"]');
    const dropdownRadio = document.querySelector('input[name="fld-options-display"][value="dropdown"]');

    // Semak jika 'Multiple-choice' sedang dipilih
    if (multiSelectRadio && multiSelectRadio.checked) {
        const selectedType = document.getElementById('fld-data-type').value.toUpperCase();
        const allowedTypes = ['TEXT', 'BLOB'];
        const isAllowed = allowedTypes.some(type => selectedType.includes(type));

        // Jika Data Type yang baru dipilih tidak serasi
        if (!isAllowed) {
            // Tukar pilihan kembali kepada default (Drop-down list)
            dropdownRadio.checked = true;
        }
    }
}

export function initializeDataTypeRules() {
    const dataTypeSelect = document.getElementById('fld-data-type');
    if (!dataTypeSelect) return;

    let previousDataType = ''; // Pembolehubah untuk simpan nilai sebelumnya

    dataTypeSelect.addEventListener('focus', () => {
        // Simpan nilai semasa setiap kali dropdown difokuskan
        previousDataType = dataTypeSelect.value;
    });

    dataTypeSelect.addEventListener('change', () => {
        const autoIncrementCheckbox = document.getElementById('fld-auto-increment');
        
        // Semak jika Auto Increment aktif
        if (autoIncrementCheckbox && autoIncrementCheckbox.checked) {
            const newDataType = dataTypeSelect.value.toUpperCase();
            const integerTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'];

            // Jika jenis data baharu BUKAN jenis integer
            if (!integerTypes.includes(newDataType)) {
                showCustomDialog({
                    title: "Validation Rule",
                    message: "An 'Auto Increment' field must have an Integer data type (e.g., INT, BIGINT)."
                });
                // Kembalikan kepada nilai sebelumnya
                dataTypeSelect.value = previousDataType;
                return; // Hentikan proses
            }
        }
        
        // Jika lulus pengesahan, jalankan peraturan sedia ada
        applyDataTypeRules();
    });
}

// js/uiHandlers.js

function populateRecordOwnerDropdown(tableName) {
    const recordOwnerDropdown = document.getElementById('tbl-record-owner');
    if (!recordOwnerDropdown || !jsonData) return;

    // Kosongkan opsyen sedia ada
    recordOwnerDropdown.innerHTML = '';

    // 1. Tambah opsyen lalai
    const defaultOption = document.createElement('option');
    defaultOption.value = ''; // Nilai kosong untuk 'Current user'
    defaultOption.textContent = 'Current user (default)';
    recordOwnerDropdown.appendChild(defaultOption);

    // ▼▼▼ LOGIK YANG DIPERBAIKI ▼▼▼
    // 2. Cari dan tambah semua medan kunci asing (foreign key) berdasarkan data hubungan
    const relationships = jsonData.database.relationships || [];
    
    relationships.forEach(rel => {
        // Cari hubungan di mana jadual semasa adalah JADUAL ANAK (child)
        if (rel.child_table_name === tableName) {
            const fkFieldName = rel.fk_child_field;
            
            const lookupOption = document.createElement('option');
            lookupOption.value = fkFieldName;
            lookupOption.textContent = fkFieldName;
            recordOwnerDropdown.appendChild(lookupOption);
        }
    });
    // ▲▲▲ TAMAT LOGIK YANG DIPERBAIKI ▲▲▲
}

// js/uiHandlers.js

export function initializeFormDisplayRules() {
    const dataTypeSelect = document.getElementById('fld-data-type');

    // --- Bahagian 1: Logik Checkbox Eksklusif ---
    const exclusiveCheckboxIds = ['fld-text-area', 'fld-rich-html', 'fld-check-box'];
    const checkboxElements = exclusiveCheckboxIds.map(id => document.getElementById(id));

    checkboxElements.forEach(checkbox => {
        if (!checkbox) return;
        checkbox.addEventListener('change', (event) => {
            const currentCheckbox = event.target;
            if (currentCheckbox.checked) {
                checkboxElements.forEach(otherCheckbox => {
                    if (otherCheckbox !== currentCheckbox) {
                        otherCheckbox.checked = false;
                    }
                });
            }
        });
    });

    // --- Bahagian 2: Logik Amaran untuk Data Type ---
    const richHtmlCheckbox = document.getElementById('fld-rich-html');
    const textAreaCheckbox = document.getElementById('fld-text-area');

    // Fungsi bantuan untuk menyemak keserasian dengan jenis data TEXT
    const checkTextCompatibility = (checkbox, warningMessage) => {
        if (!checkbox || !dataTypeSelect) return;

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                const currentDataType = dataTypeSelect.value.toUpperCase();
                const suitableTypes = ['TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];

                if (!suitableTypes.includes(currentDataType)) {
                    showCustomDialog({ title: "Warning!", message: warningMessage });
                }
            }
        });
    };

    // Laksanakan semakan untuk kedua-dua checkbox
    checkTextCompatibility(
        richHtmlCheckbox,
        "To enable this field to behave as a rich (HTML) box, you should change its data type to 'TEXT', 'MEDIUMTEXT' or 'LONGTEXT'."
    );

    checkTextCompatibility(
        textAreaCheckbox,
        "This field can only be set as a Text area if its data type is one of the 'TEXT' family data types."
    );
}

export function initializeRealtimeValidation() {
    const numericInputs = [
        document.getElementById('fld-length'),
        document.getElementById('fld-precision')
    ];

    numericInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                // Buang semua aksara yang bukan nombor
                input.value = input.value.replace(/[^0-9]/g, '');
            });
        }
    });

    // 1. Dapatkan elemen input untuk nama jadual dan medan
    const tableNameInput = document.getElementById('tbl-table-name');
    const fieldNameInput = document.getElementById('fld-field-name');

    // 2. Cipta fungsi bantuan untuk memasang logik validasi
    const setupNameValidation = (inputElement) => {
        if (!inputElement) return;

        let previousValidValue = '';

        // Simpan nilai sah terakhir apabila input difokuskan
        inputElement.addEventListener('focus', () => {
            previousValidValue = inputElement.value;
        });

        // Tapis aksara pada setiap ketikan
        inputElement.addEventListener('input', () => {
            // Hanya benarkan abjad dan garis bawah
            inputElement.value = inputElement.value.replace(/[^a-zA-Z_]/g, '');
        });

        // Semak jika kosong apabila pengguna meninggalkan input
        inputElement.addEventListener('blur', () => {
            if (inputElement.value.trim() === '') {
                // Kembalikan ke nilai sah sebelumnya jika kosong
                inputElement.value = previousValidValue;
            }
        });
    };

    // 3. Pasang validasi pada kedua-dua input
    setupNameValidation(tableNameInput);
    setupNameValidation(fieldNameInput);
}

export function initializeOptionsListRules() {
    const multiSelectRadio = document.querySelector('input[name="fld-options-display"][value="multi"]');
    const dropdownRadio = document.querySelector('input[name="fld-options-display"][value="dropdown"]');
    const dataTypeSelect = document.getElementById('fld-data-type');

    if (!multiSelectRadio || !dataTypeSelect || !dropdownRadio) return;

    multiSelectRadio.addEventListener('click', (event) => {
        const currentDataType = dataTypeSelect.value.toUpperCase();
        
        // Senarai jenis data yang dibenarkan (keluarga TEXT dan BLOB)
        const allowedTypes = ['TEXT', 'BLOB'];

        // Semak jika jenis data semasa adalah salah satu dari yang dibenarkan
        const isAllowed = allowedTypes.some(type => currentDataType.includes(type));
        if (!isAllowed) {
            event.preventDefault();
            const message = "Multiple-selection list box can only work with Text or Blob data types.\n\n" +
                          "Please change the data type of the field first.";
            showCustomDialog({ title: "Warning!", message: message });
            dropdownRadio.checked = true;
        }
    });
}

export function initializeCalculatedFieldRules() {
    const enableCheckbox = document.getElementById('fld-calculated-enable');

    if (!enableCheckbox) return;

    const validateConditions = () => {
        const getEl = (id) => document.getElementById(id);
        const getValue = (id) => getEl(id)?.value;
        const isChecked = (id) => getEl(id)?.checked;
        const errors = [];

        if (!isChecked('fld-read-only')) errors.push("Field must be set as 'Read Only'.");
        if (isChecked('fld-primary-key')) errors.push("Field cannot be a 'Primary Key'.");
        if (isChecked('fld-required')) errors.push("Field cannot be 'Required'.");
        if (isChecked('fld-text-area') || isChecked('fld-rich-html')) errors.push("Field cannot be a 'Text area' or 'Rich (HTML) area'.");
        if (isChecked('fld-auto-increment')) errors.push("Field cannot be 'Auto Increment'.");
        if (isChecked('fld-unique')) errors.push("Field cannot be 'Unique'.");
        const mediaLinkBehavior = getValue('fld-media-link-behavior');
        if (mediaLinkBehavior === 'web_link' || mediaLinkBehavior === 'email_link') errors.push("Field cannot be a 'Web/email link'.");
        const mediaType = document.querySelector('input[name="fld-media-type"]:checked')?.value;
        if (['image', 'upload'].includes(mediaType)) errors.push("Field cannot be an 'Image/file upload' type.");
        if (['gmap', 'youtube'].includes(mediaType)) errors.push("Field cannot be a 'Map/video' type.");
        if (getValue('fld-lookup-parent-table')) errors.push("Field cannot be a 'Lookup field'.");
        if (getValue('fld-options-list-values')) errors.push("Field cannot be an 'Options list' field.");
        if (getValue('fld-format-as') !== 'default') errors.push("Field cannot have a 'Data format' specified.");
        if (getValue('fld-default-value')) errors.push("Field cannot have a 'Default value'.");

        return errors;
    };

    enableCheckbox.addEventListener('click', (event) => {
        if (enableCheckbox.checked) {
            const validationErrors = validateConditions();
            if (validationErrors.length > 0) {
                event.preventDefault();
                let alertMessage = "This field cannot be set as a calculated field for the following reasons:\n\n";
                validationErrors.forEach(error => {
                    alertMessage += `- ${error}\n`;
                });
                showCustomDialog({ title: "Validation Error", message: alertMessage });
                enableCheckbox.checked = false;
            }
        }
    });

    const checkAndDisableCalculatedField = () => {
        if (!enableCheckbox.checked) return;
        const validationErrors = validateConditions();
        if (validationErrors.length > 0) {
            showCustomDialog({
                title: "Validation Rule",
                message: "Calculated field has been disabled for the following reason:\n\n" +
                         `- ${validationErrors[0]}`
            });
            enableCheckbox.checked = false;
        }
    };

    const conflictingElementIds = [
        'fld-read-only', 'fld-primary-key', 'fld-required', 'fld-text-area',
        'fld-rich-html', 'fld-auto-increment', 'fld-unique',
        'fld-media-link-behavior', 'fld-lookup-parent-table',
        'fld-options-list-values', 'fld-format-as', 'fld-default-value',
        'fld-media-image', 'fld-media-upload', 'fld-media-gmap', 'fld-media-youtube'
    ];

    conflictingElementIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', checkAndDisableCalculatedField);
        }
    });
    // Pastikan textarea sentiasa aktif (enabled) dari mula
    //queryTextarea.disabled = false;
}

export function initializeDatabasePropertiesHandlers() {
    const primaryKeyCheckbox = document.getElementById('fld-primary-key');
    const autoIncrementCheckbox = document.getElementById('fld-auto-increment');
    const requiredCheckbox = document.getElementById('fld-required');
    const readOnlyCheckbox = document.getElementById('fld-read-only');

    if (!primaryKeyCheckbox || !autoIncrementCheckbox || !requiredCheckbox || !readOnlyCheckbox) return;

    // --- Listener untuk Auto Increment ---
    autoIncrementCheckbox.addEventListener('change', () => {
        if (autoIncrementCheckbox.checked) {
            // Logik apabila MENANDA 'Auto Increment'
            if (!primaryKeyCheckbox.checked) {
                showCustomDialog({
                    title: "Validation Rule",
                    message: "'Auto Increment' can only be enabled for a 'Primary Key' field."
                });
                autoIncrementCheckbox.checked = false;
                return;
            }
            requiredCheckbox.checked = false;
            readOnlyCheckbox.checked = true;
        } else {
            // Logik apabila MENYAH-TANDA 'Auto Increment'
            const message = "Warning: Disabling Auto Increment on a key field requires you to manage unique values manually, which can lead to data errors.\n\nAre you sure you want to disable it?";
            showCustomDialog({
                title: "Warning!",
                message: message,
                showCancelButton: true,
                onCancel: () => {
                    autoIncrementCheckbox.checked = true; // Tandakan semula jika batal
                }
            });
        }
    });

    // --- Listener untuk Primary Key (Hanya untuk menyah-tanda) ---
    primaryKeyCheckbox.addEventListener('change', () => {
        if (!primaryKeyCheckbox.checked) {
            const message = "Warning: Changing a Primary Key can affect table relationships and data integrity.\n\nAre you sure you want to proceed?";
            showCustomDialog({
                title: "Warning!",
                message: message,
                showCancelButton: true,
                onCancel: () => {
                    primaryKeyCheckbox.checked = true;
                }
            });
        }
    });
    
    // --- Listener untuk Required (Tidak berubah) ---
    requiredCheckbox.addEventListener('change', () => {
        if (requiredCheckbox.checked && autoIncrementCheckbox.checked) {
            let message = "Changing this option will disable 'Auto Increment'.\n\n- Auto Increment: The value is provided automatically by the database.\n- Required: The value must be provided manually by the user.\n\n";
            const isPrimaryKey = primaryKeyCheckbox.checked;
            if (isPrimaryKey) {
                message += "Recommendation: A Primary Key field should remain 'Auto Increment'.\n\n";
            }
            message += "Are you sure you want to switch to 'Required'?";
            showCustomDialog({
                title: "Confirmation", message: message, showCancelButton: true,
                onOk: () => { autoIncrementCheckbox.checked = false; },
                onCancel: () => { requiredCheckbox.checked = false; }
            });
        }
    });

    // --- Listener untuk Read Only (Tidak berubah) ---
    readOnlyCheckbox.addEventListener('change', () => {
        if (!readOnlyCheckbox.checked && autoIncrementCheckbox.checked) {
            readOnlyCheckbox.checked = true;
            showCustomDialog({
                title: "Validation Rule",
                message: "A field with 'Auto Increment' must remain 'Read Only'."
            });
        }
    });
}

// KOD PENUH: Padam semua fungsi builder lama dan gantikan dengan keseluruhan blok ini.

// =================================================================
// ▼▼▼ SISTEM QUERY BUILDER BOLEH LARAS YANG BAHARU ▼▼▼
// =================================================================

// --- FUNGSI-FUNGSI BANTUAN UNTUK BUILDER ---

/**
 * Menguruskan kebergantungan UI dalam mod 'Advanced' Calculation Builder.
 * Ia akan mengaktifkan/menyahaktifkan 'DISTINCT' dan medan ekspresi kedua
 * berdasarkan pilihan operator.
 */
function handleAdvancedCalcDependencies() {
    const modal = document.getElementById('configurable-query-builder-modal');
    if (!modal) return;

    const operatorSelect = modal.querySelector('#cqb-expr-operator');
    if (!operatorSelect) return;

    const isOperatorEmpty = operatorSelect.value === '';

    modal.querySelector('#cqb-distinct-toggle').disabled = !isOperatorEmpty;
    modal.querySelector('#cqb-expr-field2').disabled = isOperatorEmpty;
}

/**
 * Fungsi teras untuk memaparkan dan menguruskan Query Builder yang boleh dikonfigurasi.
 * @param {object} config - Objek konfigurasi.
 */
export function showConfigurableQueryBuilder(config) {
    const modal = document.getElementById('configurable-query-builder-modal');
    if (!modal) return;

    // Tetapkan nama jadual pada modal supaya fungsi lain boleh mengaksesnya
    modal.dataset.tableName = config.tableName;

    // Rujukan kepada elemen UI utama
    const elements = {
        title: document.getElementById('cqb-modal-title'),
        modalBody: modal.querySelector('.modal-body'),
        generateBtn: document.getElementById('cqb-modal-generate-btn'),
        mandatoryRuleBox: modal.querySelector('.cb-mandatory-rule-display'),
        mandatoryRuleText: document.getElementById('cqb-mandatory-rule-text'),
        advancedToggle: document.getElementById('cqb-advanced-mode-toggle'),
        calcBasicUI: document.getElementById('cqb-calculation-basic'),
        calcAdvancedUI: document.getElementById('cqb-calculation-advanced'),
        generalFieldsUI: modal.querySelector('.qb-mode-general.qb-fields-container'),
        rulesContainer: document.getElementById('cqb-rules-container'),
        groupByUI: document.getElementById('cqb-groupby-section'),
        sortingUI: document.getElementById('cqb-sorting-section')
    };

    // 1. Tetapkan UI berdasarkan mod
    modal.querySelectorAll('.qb-mode-calculation, .qb-mode-general').forEach(el => el.classList.add('hidden'));
    modal.querySelectorAll(`.qb-mode-${config.mode}`).forEach(el => el.classList.remove('hidden'));
    
    elements.title.textContent = config.mode === 'calculation' ? 'Calculation Builder' : 'Query Builder';
    if (config.mode === 'calculation') {
        const tableData = jsonData.database.table[config.tableName];
        const pkField = Object.keys(tableData.fields).find(f => tableData.fields[f].primary_key);
        elements.mandatoryRuleText.textContent = `the calculation is linked to the current '${config.tableName}' record via its key ('${pkField || 'not found'}').`;
    }

    // 2. Sediakan builder (isi dropdown, dll.)
    setupBuilderUI(config.tableName);

    // 3. Isi builder dengan keadaan (state) awal jika ada
    populateBuilderFromState(config.initialState, config.tableName, config.mode);
    
    // Panggil fungsi baharu untuk menguruskan kebergantungan UI
    handleAdvancedCalcDependencies();
    
    // 4. Pasang event listener untuk butang 'Generate'
    const generateHandler = () => {
        const stateString = getBuilderStateAsJson(config.mode); // Dapatkan sebagai string
        const stateObject = JSON.parse(stateString); // Tukar kepada objek

        let sql = '';
        if (config.mode === 'calculation') {
            sql = generateCalculationQuery(config.tableName, stateObject);
        } else {
            sql = generateGeneralQuery(config.tableName, stateObject);
        }
        
        if (sql && typeof config.onComplete === 'function') {
            // Hantar string asal untuk disimpan
            config.onComplete(sql, stateString);
        }
        modal.classList.add('hidden');
    };
    
    // Guna klon untuk pastikan listener lama dibuang
    const newGenerateBtn = elements.generateBtn.cloneNode(true);
    elements.generateBtn.parentNode.replaceChild(newGenerateBtn, elements.generateBtn);
    newGenerateBtn.addEventListener('click', generateHandler);

    // 5. Paparkan modal
    modal.classList.remove('hidden');
}

/**
 * Fungsi Pengasas (Initializer) untuk mod 'Calculation'.
 */
export function initializeCalculationBuilder() {
    const openBtn = document.getElementById('open-calculation-builder-btn');
    openBtn?.addEventListener('click', () => {
        const [tableName, fieldName] = document.querySelector('#field-settings-page .field-name')?.textContent.split('.') || [];
        if (!tableName || !fieldName) {
             showCustomDialog({ title: "Error", message: "Please select a field first." });
             return;
        }
        const fieldData = jsonData.database.table[tableName]?.fields[fieldName];
        
        showConfigurableQueryBuilder({
            mode: 'calculation',
            tableName: tableName,
            fieldName: fieldName,
            initialState: fieldData?.calculation_builder_state || null,
            onComplete: (sql, state) => {
                SaveManager.addToQueue('fields', fieldData.field_id, {
                    calculated_query: sql,
                    calculation_builder_state: state,
                    calculated_enable: 1 // Aktifkan secara automatik
                });
            }
        });
    });
}

/**
 * Fungsi Pengasas (Initializer) untuk mod 'General'.
 */
export function initializeQueryBuilder() {


    const modal = document.getElementById('configurable-query-builder-modal');
    if (!modal) return;

    modal.querySelector('#cqb-modal-close').addEventListener('click', () => modal.classList.add('hidden'));
    modal.querySelector('#cqb-modal-cancel-btn').addEventListener('click', () => modal.classList.add('hidden'));

    modal.querySelector('#cqb-advanced-mode-toggle')?.addEventListener('change', (e) => {
        const isAdvanced = e.target.checked;
        modal.querySelector('#cqb-calculation-basic').classList.toggle('hidden', isAdvanced);
        modal.querySelector('#cqb-calculation-advanced').classList.toggle('hidden', !isAdvanced);
    });

    // Pasang listener untuk operator dalam mod lanjutan
    modal.querySelector('#cqb-expr-operator')?.addEventListener('change', handleAdvancedCalcDependencies);

    modal.querySelector('#cqb-calc-function')?.addEventListener('change', (e) => {
        modal.querySelector('#cqb-calc-field-container').classList.toggle('hidden', e.target.value === 'COUNT');
    });

    modal.querySelector('#cqb-gen-add-field')?.addEventListener('click', () => moveFields('#cqb-gen-available-fields', '#cqb-gen-selected-fields'));
    modal.querySelector('#cqb-gen-remove-field')?.addEventListener('click', () => moveFields('#cqb-gen-selected-fields', '#cqb-gen-available-fields'));
    modal.querySelector('#cqb-groupby-add-field')?.addEventListener('click', () => moveFields('#cqb-groupby-available-fields', '#cqb-groupby-selected-fields'));
    modal.querySelector('#cqb-groupby-remove-field')?.addEventListener('click', () => moveFields('#cqb-groupby-selected-fields', '#cqb-groupby-available-fields'));

    // Butang tambah peraturan, kumpulan, dan susunan
    modal.querySelector('#cqb-add-rule')?.addEventListener('click', (e) => addRuleOrGroup(e.target, 'rule'));
    modal.querySelector('#cqb-add-group')?.addEventListener('click', (e) => addRuleOrGroup(e.target, 'group'));
    modal.querySelector('#cqb-add-sort-level')?.addEventListener('click', () => {
        const tableName = modal.dataset.tableName;
        document.getElementById('cqb-sort-container').appendChild(createSortElement(tableName));
    });

    // Event delegation untuk semua klik di dalam modal
    modal.addEventListener('click', e => {
        const target = e.target;
        const button = target.closest('button');

        if (target.tagName === 'LI' && target.closest('.qb-field-list')) {
            target.classList.toggle('selected');
        } else if (button?.classList.contains('cqb-delete-btn')) {
            button.closest('.cqb-rule, .cqb-rule-group, .cqb-sort-rule')?.remove();
        } else if (button?.classList.contains('cqb-add-nested-rule')) {
            addRuleOrGroup(button, 'rule');
        } else if (button?.classList.contains('cqb-add-nested-group')) {
            addRuleOrGroup(button, 'group');
        }
    });

    // Tukar senarai medan apabila jadual dalam peraturan diubah
    modal.addEventListener('change', (e) => {
        if (e.target.classList.contains('cqb-rule-table')) {
            const selectedTable = e.target.value;
            const fieldDropdown = e.target.closest('.cqb-rule').querySelector('.cqb-rule-field');
            if (!fieldDropdown || !jsonData.database.table[selectedTable]) return;
            fieldDropdown.innerHTML = '';
            const fields = Object.keys(jsonData.database.table[selectedTable].fields);
            fields.forEach(fieldName => {
                const option = document.createElement('option'); option.value = fieldName; option.textContent = fieldName;
                fieldDropdown.appendChild(option);
            });
        }
    });
}

// --- FUNGSI-FUNGSI BANTUAN UNTUK BUILDER ---

/**
 * Mengimbas keadaan penapis (filter state) dan mengembalikan satu Set
 * yang mengandungi semua nama jadual unik yang digunakan dalam peraturan.
 * @param {object} filterState - Objek keadaan penapis dari builder.
 * @returns {Set<string>} Satu Set nama jadual.
 */
function getTablesFromFilters(filterState) {
    const tables = new Set();
    if (!filterState || !filterState.rules) return tables;

    function traverse(rules) {
        rules.forEach(rule => {
            if (rule.type === 'rule') {
                tables.add(rule.table);
            } else if (rule.type === 'group') {
                traverse(rule.rules);
            }
        });
    }

    traverse(filterState.rules);
    return tables;
}

/**
 * Membina klausa LEFT JOIN berdasarkan hubungan Parent/Child yang telah ditetapkan.
 * @param {string} mainTable - Nama jadual utama dalam klausa FROM.
 * @param {Set<string>} tablesInFilters - Satu Set jadual yang digunakan dalam penapis.
 * @returns {string} String klausa JOIN yang lengkap, cth: "\nLEFT JOIN `customers` ON ..."
 */
function buildJoinClause(mainTable, tablesInFilters) {
    const allRelationships = jsonData.database.relationships;
    let joinClauses = '';

    tablesInFilters.forEach(tableToJoin => {
        if (tableToJoin === mainTable) return; // Langkau jadual utama

        const foundRelationship = allRelationships.find(rel =>
            (rel.parent_table_name === mainTable && rel.child_table_name === tableToJoin) ||
            (rel.parent_table_name === tableToJoin && rel.child_table_name === mainTable)
        );

        if (foundRelationship) {
            const onClause = `\`${foundRelationship.parent_table_name}\`.\`${foundRelationship.parent_field}\` = \`${foundRelationship.child_table_name}\`.\`${foundRelationship.fk_child_field}\``;
            joinClauses += `\nLEFT JOIN \`${tableToJoin}\` ON ${onClause}`;
        } else {
            console.warn(`Tiada hubungan terus ditemui antara '${mainTable}' dan '${tableToJoin}'. Ia akan dilangkau.`);
        }
    });

    return joinClauses;
}

// =================================================================
// ▼▼▼ SISTEM QUERY BUILDER BOLEH LARAS YANG BAHARU ▼▼▼
// =================================================================

// --- FUNGSI-FUNGSI BANTUAN UNTUK BUILDER ---

function setupBuilderUI(tableName) {
    const numericTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'];
    const fields = jsonData.database.table[tableName].fields;
    
    const elements = {
        calcField: document.getElementById('cqb-calc-field'),
        exprField1: document.getElementById('cqb-expr-field1'),
        exprField2: document.getElementById('cqb-expr-field2'),
        groupByAvailable: document.getElementById('cqb-groupby-available-fields'),
        genAvailable: document.getElementById('cqb-gen-available-fields')
    };

    // Kosongkan semua senarai
    Object.values(elements).forEach(el => el.innerHTML = '');
    document.getElementById('cqb-gen-selected-fields').innerHTML = '';
    document.getElementById('cqb-groupby-selected-fields').innerHTML = '';
    document.getElementById('cqb-rules-container').innerHTML = '';
    document.getElementById('cqb-sort-container').innerHTML = '';
    
    for (const fieldName in fields) {
        const fieldData = fields[fieldName];
        
        const li = document.createElement('li');
        li.dataset.value = fieldName;
        li.textContent = fieldName;
        elements.groupByAvailable.appendChild(li.cloneNode(true));
        elements.genAvailable.appendChild(li.cloneNode(true));

        if (numericTypes.includes(fieldData.data_type.toUpperCase())) {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            elements.calcField.appendChild(option.cloneNode(true));
            elements.exprField1.appendChild(option.cloneNode(true));
            elements.exprField2.appendChild(option.cloneNode(true));
        }
    }
}

function getBuilderStateAsJson(mode) {
    let state = { mode };

    if (mode === 'calculation') {
        state.isAdvanced = document.getElementById('cqb-advanced-mode-toggle').checked;

        // Sentiasa baca keadaan untuk SEMUA kawalan, tidak kira mod semasa.
        // Ini menghalang kehilangan data apabila bertukar antara mod Asas dan Lanjutan.
        state.basicFunction = document.getElementById('cqb-calc-function').value;
        state.field = document.getElementById('cqb-calc-field').value;
        state.advancedFunction = document.getElementById('cqb-adv-function').value;
        state.isDistinct = document.getElementById('cqb-distinct-toggle').checked;
        state.expr1 = document.getElementById('cqb-expr-field1').value;
        state.operator = document.getElementById('cqb-expr-operator').value;
        state.expr2 = document.getElementById('cqb-expr-field2').value;
        state.groupBy = Array.from(document.querySelectorAll('#cqb-groupby-selected-fields li')).map(li => li.dataset.value);

    } else { // general mode
        state.selectedFields = Array.from(document.querySelectorAll('#cqb-gen-selected-fields li')).map(li => li.dataset.value);
        state.sorting = Array.from(document.querySelectorAll('.cqb-sort-rule')).map(rule => ({
            field: rule.querySelector('.cqb-sort-field').value,
            direction: rule.querySelector('.cqb-sort-direction').value
        }));
    }

    state.filters = readRuleState(document.getElementById('cqb-rules-container'));
    return JSON.stringify(state);
}

function populateBuilderFromState(jsonState, tableName, mode) {
    if (!jsonState) return;
    try {
        const state = JSON.parse(jsonState);
        if (mode === 'calculation' && state.mode === 'calculation') {
            const advancedToggle = document.getElementById('cqb-advanced-mode-toggle');
            advancedToggle.checked = state.isAdvanced;
            advancedToggle.dispatchEvent(new Event('change'));
            if (state.isAdvanced) {
                document.getElementById('cqb-adv-function').value = state.advancedFunction;
                document.getElementById('cqb-distinct-toggle').checked = state.isDistinct;
                document.getElementById('cqb-expr-field1').value = state.expr1;
                document.getElementById('cqb-expr-operator').value = state.operator;
                document.getElementById('cqb-expr-field2').value = state.expr2;
                const available = [...document.querySelectorAll('#cqb-groupby-available-fields li')];
                state.groupBy.forEach(fieldName => {
                    const li = available.find(item => item.dataset.value === fieldName);
                    if (li) document.getElementById('cqb-groupby-selected-fields').appendChild(li);
                });
            } else {
                document.getElementById('cqb-calc-function').value = state.basicFunction;
                document.getElementById('cqb-calc-field').value = state.field;
                document.getElementById('cqb-calc-function').dispatchEvent(new Event('change'));
            }
        } else if (mode === 'general' && state.mode === 'general') {
            const available = [...document.querySelectorAll('#cqb-gen-available-fields li')];
            state.selectedFields.forEach(fieldName => {
                const li = available.find(item => item.dataset.value === fieldName);
                if (li) document.getElementById('cqb-gen-selected-fields').appendChild(li);
            });
            state.sorting.forEach(sortRule => {
                document.getElementById('cqb-sort-container').appendChild(createSortElement(tableName, sortRule));
            });
        }
        buildRulesUI(document.getElementById('cqb-rules-container'), state.filters, tableName);
    } catch (e) {
        console.error("Failed to parse or populate builder from state:", e);
    }
}

function generateCalculationQuery(tableName, state) {
    const pkField = Object.keys(jsonData.database.table[tableName].fields).find(f => jsonData.database.table[tableName].fields[f].primary_key === 1);
    if (!pkField) {
        showCustomDialog({title: "Error", message: `Could not find a primary key for table '${tableName}'.`});
        return '';
    }
    
    const tablesInFilters = getTablesFromFilters(state.filters);
    const joinClause = buildJoinClause(tableName, tablesInFilters);

    let selectClause = 'SELECT ';
    let aggregation;
    let functionName;

    if (state.isAdvanced) {
        functionName = state.advancedFunction;
        const expression = (state.operator && state.expr2) ? `\`${state.expr1}\` ${state.operator} \`${state.expr2}\`` : `\`${state.expr1}\``;
        aggregation = `${functionName}(${state.isDistinct ? 'DISTINCT ' : ''}${expression})`;
    } else {
        functionName = state.basicFunction;
        aggregation = functionName === 'COUNT' ? 'COUNT(*)' : `${functionName}(\`${state.field}\`)`;
    }

    // Balut dengan COALESCE untuk memastikan nombor sentiasa dikembalikan (0 bukannya NULL)
    // KECUALI untuk fungsi COUNT, kerana ia sentiasa mengembalikan nombor.
    if (functionName === 'COUNT') {
        selectClause += aggregation;
    } else {
        selectClause += `COALESCE(${aggregation}, 0)`;
    }

    let query = `${selectClause}\nFROM \`${tableName}\`${joinClause}`;
    const mandatoryCondition = `\`${tableName}\`.\`${pkField}\` = ##ID##`;
    const optionalConditions = buildNestedWhereClause(state.filters);
    
    query += `\nWHERE ${mandatoryCondition}`;
    if (optionalConditions) query += `\n    AND ${optionalConditions}`;
    if (state.isAdvanced && state.groupBy.length > 0) {
        query += '\nGROUP BY ' + state.groupBy.map(f => `\`${f}\``).join(', ');
    }
    return query + ';';
}

function generateGeneralQuery(tableName, state) {
    // Tambah awalan nama jadual untuk mengelakkan ralat kekaburan (ambiguity)
    const selectClause = 'SELECT\n    ' + (state.selectedFields.length === 0 ? '*' : state.selectedFields.map(f => `\`${tableName}\`.\`${f}\``).join(',\n    '));
    
    const tablesInFilters = getTablesFromFilters(state.filters);
    const joinClause = buildJoinClause(tableName, tablesInFilters);

    const fromClause = `\nFROM\n    \`${tableName}\`${joinClause}`;
    const whereClause = buildNestedWhereClause(state.filters) ? `\nWHERE\n    ${buildNestedWhereClause(state.filters)}` : '';
    // Tambah awalan nama jadual untuk mengelakkan ralat kekaburan (ambiguity)
    const orderByClause = state.sorting.length > 0 ? '\nORDER BY\n    ' + state.sorting.map(s => `\`${tableName}\`.\`${s.field}\` ${s.direction}`).join(', ') : '';
    return `${selectClause}${fromClause}${whereClause}${orderByClause};`;
}

function createRuleElement(tableName, data = null) {
    const newRule = document.createElement('div');
    newRule.className = 'cqb-rule';
    const relationships = jsonData.database.relationships || [];
    const relatedTables = new Set([tableName]);
    relationships.forEach(rel => {
        if (rel.parent_table_name === tableName) relatedTables.add(rel.child_table_name);
        if (rel.child_table_name === tableName) relatedTables.add(rel.parent_table_name);
    });
    const tableOptions = Array.from(relatedTables).map(t => `<option value="${t}">${t}</option>`).join('');
    const initialTable = data ? data.table : tableName;
    const fields = jsonData.database.table[initialTable]?.fields || {};
    const fieldOptions = Object.keys(fields).map(f => `<option value="${f}">${f}</option>`).join('');

    const operators = [
        { value: '=', text: 'is equal to' },
        { value: '!=', text: 'is not equal to' },
        { value: '>', text: 'is greater than' },
        { value: '<', text: 'is less than' },
        { value: '>=', text: 'is greater than or equal to' },
        { value: '<=', text: 'is less than or equal to' },
        { value: 'LIKE', text: 'contains' },
        { value: 'NOT LIKE', text: 'does not contain' },
        { value: 'IN', text: 'is one of (a,b,c)' },
        { value: 'NOT IN', text: 'is not one of (a,b,c)' },
        { value: 'IS NULL', text: 'is empty (NULL)' },
        { value: 'IS NOT NULL', text: 'is not empty (not NULL)' }
    ];
    const operatorOptions = operators.map(op => `<option value="${op.value}">${op.text}</option>`).join('');

    newRule.innerHTML = `<select class="cqb-rule-table">${tableOptions}</select><select class="cqb-rule-field">${fieldOptions}</select><select class="cqb-rule-operator">${operatorOptions}</select><input type="text" class="cqb-rule-value" placeholder="Value..."><button class="cqb-delete-btn">&times;</button>`;
    
    const operatorSelect = newRule.querySelector('.cqb-rule-operator');
    const valueInput = newRule.querySelector('.cqb-rule-value');

    // Sembunyikan input nilai jika operator adalah IS NULL atau IS NOT NULL
    operatorSelect.addEventListener('change', (e) => {
        const operator = e.target.value;
        valueInput.classList.toggle('hidden', operator === 'IS NULL' || operator === 'IS NOT NULL');
    });

    if (data) {
        newRule.querySelector('.cqb-rule-table').value = data.table;
        newRule.querySelector('.cqb-rule-field').value = data.field;
        operatorSelect.value = data.operator;
        newRule.querySelector('.cqb-rule-value').value = data.value;
        // Cetuskan 'change' untuk menetapkan keadaan awal UI yang betul
        operatorSelect.dispatchEvent(new Event('change'));
    }
    return newRule;
}

function createRuleGroupElement() {
    const groupEl = document.createElement('div');
    groupEl.className = 'cqb-rule-group';
    const uniqueName = `cqb-group-logic-${Math.random().toString(36).substr(2, 9)}`;
    groupEl.innerHTML = `<div class="qb-logic-toggle"><label><input type="radio" name="${uniqueName}" value="AND" checked> Match ALL</label><label><input type="radio" name="${uniqueName}" value="OR"> Match ANY</label></div><div class="qb-nested-rules"></div><div class="group-actions mt-1"><button class="btn btn-secondary btn-sm cqb-add-nested-rule"><i class="fas fa-plus"></i> Add Rule</button><button class="btn btn-secondary btn-sm cqb-add-nested-group"><i class="fas fa-layer-group"></i> Add Group</button><button class="cqb-delete-btn" style="float: right;">&times;</button></div>`;
    return groupEl;
}

function createSortElement(tableName, data = null) {
    const newSortRule = document.createElement('div');
    newSortRule.className = 'cqb-sort-rule';
    const fields = Object.keys(jsonData.database.table[tableName]?.fields || {});
    const fieldOptions = fields.map(f => `<option value="${f}">${f}</option>`).join('');
    newSortRule.innerHTML = `<select class="cqb-sort-field">${fieldOptions}</select><select class="cqb-sort-direction"><option value="ASC">Ascending (A-Z)</option><option value="DESC">Descending (Z-A)</option></select><button class="cqb-delete-btn">&times;</button>`;
    if (data) {
        newSortRule.querySelector('.cqb-sort-field').value = data.field;
        newSortRule.querySelector('.cqb-sort-direction').value = data.direction;
    }
    return newSortRule;
}

function buildNestedWhereClause(filterState) {
    if (!filterState || !filterState.rules || filterState.rules.length === 0) return '';
    const logic = filterState.logic || 'AND';
    const conditions = filterState.rules.map(rule => {
        if (rule.type === 'rule') {
            const { table, field, operator, value } = rule;
            const fieldData = jsonData.database.table[table]?.fields[field];
            if (!fieldData) return null; // Langkau jika maklumat medan tiada

            // Kendalikan operator yang tidak memerlukan nilai
            if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
                return `\`${table}\`.\`${field}\` ${operator}`;
            }

            // Kendalikan IN dan NOT IN
            if (operator === 'IN' || operator === 'NOT IN') {
                const list = value.split(',').map(item => {
                    const trimmed = item.trim();
                    // Letak petikan jika bukan nombor, jika tidak guna seadanya
                    return isNaN(trimmed) || trimmed === '' ? `'${trimmed.replace(/'/g, "''")}'` : trimmed;
                }).join(', ');
                return `\`${table}\`.\`${field}\` ${operator} (${list})`;
            }

            // Kendalikan operator lain yang mempunyai nilai
            const numericTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'];
            const isNumeric = numericTypes.includes(fieldData.data_type.toUpperCase());
            
            let formattedValue;
            if (operator === 'LIKE' || operator === 'NOT LIKE') {
                 formattedValue = `'%${String(value || '').replace(/'/g, "''")}%'`;
            } else if (isNumeric) {
                formattedValue = parseFloat(value);
                if (isNaN(formattedValue)) formattedValue = 0; // Lalai kepada 0 jika tidak sah
            } else {
                // Untuk rentetan, tarikh, dll., balut dengan petikan dan escape
                formattedValue = `'${String(value || '').replace(/'/g, "''")}'`;
            }

            return `\`${table}\`.\`${field}\` ${operator} ${formattedValue}`;
        }
        if (rule.type === 'group') {
            return buildNestedWhereClause(rule);
        }
        return null;
    }).filter(c => c); // Tapis keluar keadaan yang null/kosong
    return conditions.length > 0 ? `(${conditions.join(` ${logic} `)})` : '';
}

function moveFields(sourceSelector, destinationSelector) {
    const source = document.querySelector(sourceSelector);
    const destination = document.querySelector(destinationSelector);
    const itemsToMove = source.querySelectorAll('li.selected');
    itemsToMove.forEach(item => { item.classList.remove('selected'); destination.appendChild(item); });
}

function addRuleOrGroup(button, type) {
    const targetContainer = button.closest('.cqb-rule-group, #cqb-container').querySelector('.qb-nested-rules, #cqb-rules-container');
    const tableName = button.closest('#configurable-query-builder-modal').dataset.tableName;
    if (targetContainer) {
        if(type === 'rule') targetContainer.appendChild(createRuleElement(tableName));
        else targetContainer.appendChild(createRuleGroupElement());
    }
}

function readRuleState(container) {
    const logicRadio = container.parentElement.querySelector(':scope > .qb-logic-toggle input:checked');
    const logic = logicRadio ? logicRadio.value : 'AND';
    let rules = [];
    Array.from(container.children).forEach(child => {
        if (child.classList.contains('cqb-rule')) {
            rules.push({
                type: 'rule',
                table: child.querySelector('.cqb-rule-table').value,
                field: child.querySelector('.cqb-rule-field').value,
                operator: child.querySelector('.cqb-rule-operator').value,
                value: child.querySelector('.cqb-rule-value').value,
            });
        } else if (child.classList.contains('cqb-rule-group')) {
            rules.push({ type: 'group', ...readRuleState(child.querySelector('.qb-nested-rules')) });
        }
    });
    return { logic, rules };
}

function buildRulesUI(container, filterGroup, tableName) {
    if (!filterGroup) return;
    const logicRadio = container.parentElement.querySelector(`:scope > .qb-logic-toggle input[value="${filterGroup.logic}"]`);
    if (logicRadio) logicRadio.checked = true;
    filterGroup.rules.forEach(rule => {
        if (rule.type === 'rule') {
            container.appendChild(createRuleElement(tableName, rule));
        } else if (rule.type === 'group') {
            const groupEl = createRuleGroupElement();
            container.appendChild(groupEl);
            buildRulesUI(groupEl.querySelector('.qb-nested-rules'), rule, tableName);
        }
    });
}