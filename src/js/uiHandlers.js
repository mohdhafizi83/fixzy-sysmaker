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

    let isRebuildingUI = false;
    let modalCanvasState = '[]';
	
    // ▼▼▼ FUNGSI BANTUAN DIPINDAHKAN KE SINI UNTUK SKOP YANG BETUL ▼▼▼
    const updateChildMathUI = (componentEl) => {
        if (!componentEl) return;
        const aggregateSelect = componentEl.querySelector('.aggregate-select');
        const fieldSelect = componentEl.querySelector('.field-select');
        const countStar = componentEl.querySelector('.count-star');
        if (!aggregateSelect || !fieldSelect || !countStar) return;

        const isCount = aggregateSelect.value === 'COUNT';
        fieldSelect.classList.toggle('hidden', isCount);
        countStar.classList.toggle('hidden', !isCount);
    };
    // ▲▲▲ TAMAT PEMINDAHAN FUNGSI BANTUAN ▲▲▲

    // ▼▼▼ MULA FUNGSI BANTUAN UNTUK JANA QUERY ▼▼▼
    const buildWhereClauseForQuery = (whereData, tableName) => {
        if (!whereData || !whereData.rules || whereData.rules.length === 0) return '';
        
        const logic = whereData.logic || 'AND';
        const conditions = whereData.rules.map(rule => {
            if (!rule.field || !rule.operator) return null;
            
            const fieldData = jsonData.database.table[tableName]?.fields[rule.field];
            if (!fieldData) return null;

            if (rule.operator === 'IS NULL' || rule.operator === 'IS NOT NULL') {
                return `\`${rule.field}\` ${rule.operator}`;
            }
            return `\`${rule.field}\` ${rule.operator} ?`;
        }).filter(c => c);

        return conditions.length > 0 ? `WHERE (${conditions.join(` ${logic} `)})` : '';
    };

    const generateInsertQuery = (table, fields) => {
        if (!table || !fields || fields.length === 0) return '';
        const fieldNames = fields.map(f => `\`${f.field}\``).join(', ');
        const placeholders = fields.map(() => '?').join(', ');
        return `INSERT INTO \`${table}\` (${fieldNames}) VALUES (${placeholders});`;
    };

    const generateUpdateQuery = (table, setClause, whereClause) => {
        if (!table || !setClause || setClause.length === 0) return '';
        const setPairs = setClause.map(s => `\`${s.field}\` = ?`).join(', ');
        const whereString = buildWhereClauseForQuery(whereClause, table);
        return `UPDATE \`${table}\` SET ${setPairs} ${whereString};`;
    };
    
    const generateDeleteQuery = (table, whereClause) => {
        if (!table) return '';
        const whereString = buildWhereClauseForQuery(whereClause, table);
        return `DELETE FROM \`${table}\` ${whereString};`;
    };
    // ▲▲▲ TAMAT FUNGSI BANTUAN ▲▲▲

    // ▼▼▼ ALL ORIGINAL HELPER FUNCTIONS ARE PRESENT ▼▼▼
    const populateFieldsForRelatedData = (componentEl) => {
        const fieldMultiSelect = componentEl.querySelector('.field-multiselect');
        if (!fieldMultiSelect) return;

        const currentlySelected = Array.from(fieldMultiSelect.selectedOptions).map(opt => opt.value);
        fieldMultiSelect.innerHTML = '';

        const mainChildTable = componentEl.querySelector('.table-select').value;
        const joinRuleElements = componentEl.querySelectorAll('.cqb-join-rule .cqb-rule-table');
        const tablesInvolved = new Set([mainChildTable]);
        joinRuleElements.forEach(select => tablesInvolved.add(select.value));
        
        tablesInvolved.forEach(tableName => {
            const tableData = jsonData.database.table[tableName];
            if (tableData && tableData.fields) {
                for (const fieldName in tableData.fields) {
                    const option = document.createElement('option');
                    const qualifiedName = `${tableName}.${fieldName}`;
                    option.value = qualifiedName;
                    option.textContent = qualifiedName;
                    fieldMultiSelect.appendChild(option);
                }
            }
        });
        
        currentlySelected.forEach(selectedValue => {
            const optionToSelect = fieldMultiSelect.querySelector(`option[value="${selectedValue}"]`);
            if (optionToSelect) {
                optionToSelect.selected = true;
            }
        });
    };

    const buildRelatedDataQuery = (itemData, parentTable) => {
        if (!itemData.table || !itemData.fields || itemData.fields.length === 0) {
            return "SELECT ''"; 
        }

        const { table: childTable, fields: selectedFields, filter: filterState } = itemData;
        const relationship = jsonData.database.relationships.find(
            r => r.parent_table_name === parentTable && r.child_table_name === childTable
        );
        const fkField = relationship ? relationship.fk_child_field : 'unknown_fk';

        const concatenatedFields = `CONCAT_WS(' - ', ${selectedFields.map(f => {
            const [tbl, fld] = f.split('.');
            return (tbl && fld) ? `\`${tbl}\`.\`${fld}\`` : '';
        }).filter(Boolean).join(', ')})`;
        
        if (!concatenatedFields) return "SELECT ''";

        const groupConcatClause = `GROUP_CONCAT(${concatenatedFields} SEPARATOR ', ')`;
        const joinClause = buildChildMathJoinClause(childTable, filterState);
        const whereClause = buildChildWhereClause(filterState, childTable);
        
        const query = `SELECT COALESCE(${groupConcatClause}, '') FROM \`${childTable}\` ${joinClause} WHERE \`${childTable}\`.\`${fkField}\` = ##ID## ${whereClause}`;

        return query.replace(/\s+/g, ' ').trim();
    };

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

    const buildChildMathJoinClause = (childTable, filterState) => {
        if (!filterState || !filterState.rules) return '';
        const allRelationships = jsonData.database.relationships;
        let joinClauses = '';

        const tablesToJoin = new Set();
        filterState.rules.forEach(rule => {
            if (rule.type === 'join_rule') {
                tablesToJoin.add(rule.table);
            }
        });

        tablesToJoin.forEach(tableToJoin => {
            if (tableToJoin === childTable) return;

            const foundRelationship = allRelationships.find(rel =>
                (rel.parent_table_name === childTable && rel.child_table_name === tableToJoin) ||
                (rel.parent_table_name === tableToJoin && rel.child_table_name === childTable)
            );

            if (foundRelationship) {
                const onClause = `\`${foundRelationship.parent_table_name}\`.\`${foundRelationship.parent_field}\` = \`${foundRelationship.child_table_name}\`.\`${foundRelationship.fk_child_field}\``;
                joinClauses += `\nLEFT JOIN \`${tableToJoin}\` ON ${onClause}`;
            }
        });

        return joinClauses;
    };

    const buildChildWhereClause = (filterState, childTable) => {
        if (!filterState || !filterState.rules || filterState.rules.length === 0) return '';
        const logic = filterState.logic || 'AND';
        const conditions = filterState.rules.map(rule => {
            const { operator, value } = rule;
            
            let tableName, fieldName, fieldData;
            if (rule.type === 'join_rule') {
                tableName = rule.table;
                fieldName = rule.field;
                fieldData = jsonData.database.table[tableName]?.fields[fieldName];
            } else { // 'standard' rule
                tableName = childTable;
                fieldName = rule.field;
                fieldData = jsonData.database.table[tableName]?.fields[fieldName];
            }

            if (!fieldData) return null;

            if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
                return `\`${tableName}\`.\`${fieldName}\` ${operator}`;
            }

            const numericTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'];
            const isNumeric = numericTypes.includes(fieldData.data_type.toUpperCase());
            
            let formattedValue;
            if (operator === 'LIKE' || operator === 'NOT LIKE') {
                 formattedValue = `'%${String(value || '').replace(/'/g, "''")}%'`;
            } else if (isNumeric) {
                formattedValue = parseFloat(value);
                if (isNaN(formattedValue)) formattedValue = 0;
            } else {
                formattedValue = `'${String(value || '').replace(/'/g, "''")}'`;
            }

            return `\`${tableName}\`.\`${fieldName}\` ${operator} ${formattedValue}`;
        }).filter(c => c);

        return conditions.length > 0 ? `AND (${conditions.join(` ${logic} `)})` : '';
    };

const updateModalCanvasState = () => {
        if (isRebuildingUI) return;

        // Helper function to read the new complex WHERE clause
        const readWhereClauseState = (container) => {
            if (!container) return null;
            const logicRadio = container.querySelector(':scope > .qb-logic-toggle input:checked');
            return {
                logic: logicRadio ? logicRadio.value : 'AND',
                rules: Array.from(container.querySelectorAll('.child-math-rules-list .cqb-rule')).map(ruleEl => ({
                    field: ruleEl.querySelector('.cqb-rule-field').value,
                    operator: ruleEl.querySelector('.cqb-rule-operator').value,
                    value: ruleEl.querySelector('.cqb-rule-value').value
                }))
            };
        };

        const mapItems = (container) => {
            const children = Array.from(container.children).filter(el => el.classList.contains('dropped-item'));
            return children.map(item => {
                const type = item.dataset.itemType;
                let itemData = { type };

                // ▼▼▼ LOGIK ASAL UNTUK KOMPONEN SEDIA ADA (DIKEMBALIKAN) ▼▼▼
                if (type === 'function') {
                    itemData.name = item.dataset.functionName;
                    const argContainer = item.querySelector('.function-argument-droppable');
                    itemData.arguments = mapItems(argContainer);
                } else if (type === 'comment') {
                    itemData.value = item.querySelector('textarea')?.value;
                } else if (type === 'field') {
                    itemData.table = item.querySelector('.table-select')?.value;
                    itemData.field = item.querySelector('.field-select')?.value;
                } else if (type === 'lookup_value') {
                    itemData.table = item.querySelector('.table-select')?.value;
                    itemData.field = item.querySelector('.field-select')?.value;
                    
                    const filterContainer = item.querySelector('.lookup-value-filter-container');
                    if (filterContainer) {
                        const valueType = filterContainer.querySelector('.lookup-cond-value-type').value;
                        const value = (valueType === 'static') 
                            ? filterContainer.querySelector('.lookup-cond-static-value').value
                            : filterContainer.querySelector('.lookup-cond-dynamic-value').value;
                            
                        itemData.condition = {
                            field: filterContainer.querySelector('.lookup-cond-external-field').value,
                            operator: filterContainer.querySelector('.lookup-cond-operator').value,
                            valueType: valueType,
                            value: value
                        };
                    }
                } else if (type === 'this_record_data') {
                    const activeTable = context.tableName;
                    const fields = jsonData.database.table[activeTable].fields;
                    const selectedField = item.querySelector('.field-select')?.value;
                    const pkName = Object.keys(fields).find(f => fields[f].primary_key === 1) || 'id';

                    itemData.field = selectedField;
                    itemData.query = `SELECT \`${selectedField}\` FROM \`${activeTable}\` WHERE \`${pkName}\` = ##ID##`;
                } else if (type === 'calculate_related_record') {
                    const parentTable = context.tableName;
                    const childTable = item.querySelector('.table-select')?.value;
                    const aggregate = item.querySelector('.aggregate-select')?.value;
                    const field = item.querySelector('.field-select')?.value;

                    itemData.table = childTable;
                    itemData.aggregate = aggregate;
                    itemData.field = (aggregate === 'COUNT') ? '*' : field;

                    const relationship = jsonData.database.relationships.find(
                        r => r.parent_table_name === parentTable && r.child_table_name === childTable
                    );
                    const fkField = relationship ? relationship.fk_child_field : 'unknown_fk';

                    const filterContainer = item.querySelector('.child-math-filter-container');
                    if (filterContainer) {
                        const logicRadio = filterContainer.querySelector(':scope > .qb-logic-toggle input:checked');
                        itemData.filter = {
                            logic: logicRadio ? logicRadio.value : 'AND',
                            rules: Array.from(filterContainer.querySelectorAll('.cqb-rule, .cqb-join-rule')).map(ruleEl => {
                                if (ruleEl.classList.contains('cqb-join-rule')) {
                                    return {
                                        type: 'join_rule',
                                        table: ruleEl.querySelector('.cqb-rule-table').value,
                                        field: ruleEl.querySelector('.cqb-rule-field').value,
                                        operator: ruleEl.querySelector('.cqb-rule-operator').value,
                                        value: ruleEl.querySelector('.cqb-rule-value').value
                                    };
                                } else { // standard
                                    return {
                                        type: 'standard_rule',
                                        field: ruleEl.querySelector('.cqb-rule-field').value,
                                        operator: ruleEl.querySelector('.cqb-rule-operator').value,
                                        value: ruleEl.querySelector('.cqb-rule-value').value
                                    };
                                }
                            })
                        };
                    }

                    const joinClause = buildChildMathJoinClause(childTable, itemData.filter);
                    const whereClause = buildChildWhereClause(childTable, itemData.filter);
                    
                    let query;
                    if (aggregate === 'COUNT') {
                        query = `SELECT COUNT(*) FROM \`${childTable}\` ${joinClause} WHERE \`${childTable}\`.\`${fkField}\` = ##ID## ${whereClause}`;
                    } else {
                        const [fieldTable, fieldName] = field.split('.');
                        query = `SELECT COALESCE(${aggregate}(\`${fieldTable}\`.\`${fieldName}\`), 0) FROM \`${childTable}\` ${joinClause} WHERE \`${childTable}\`.\`${fkField}\` = ##ID## ${whereClause}`;
                    }
                    itemData.query = query.replace(/\s+/g, ' ').trim();

                } else if (type === 'related_record_data') {
                    const childTable = item.querySelector('.table-select')?.value;
                    const selectedFields = Array.from(item.querySelector('.field-multiselect').selectedOptions).map(opt => opt.value);

                    itemData.table = childTable;
                    itemData.fields = selectedFields; 

                    const filterContainer = item.querySelector('.child-math-filter-container');
                    if (filterContainer) {
                        const logicRadio = filterContainer.querySelector(':scope > .qb-logic-toggle input:checked');
                        itemData.filter = {
                            logic: logicRadio ? logicRadio.value : 'AND',
                            rules: Array.from(filterContainer.querySelectorAll('.cqb-rule, .cqb-join-rule')).map(ruleEl => {
                                if (ruleEl.classList.contains('cqb-join-rule')) {
                                    return {
                                        type: 'join_rule',
                                        table: ruleEl.querySelector('.cqb-rule-table').value,
                                        field: ruleEl.querySelector('.cqb-rule-field').value,
                                        operator: ruleEl.querySelector('.cqb-rule-operator').value,
                                        value: ruleEl.querySelector('.cqb-rule-value').value
                                    };
                                } else { // standard
                                    return {
                                        type: 'standard_rule',
                                        field: ruleEl.querySelector('.cqb-rule-field').value,
                                        operator: ruleEl.querySelector('.cqb-rule-operator').value,
                                        value: ruleEl.querySelector('.cqb-rule-value').value
                                    };
                                }
                            })
                        };
                    }
                    
                    itemData.query = buildRelatedDataQuery(itemData, context.tableName);
                
                // ▼▼▼ LOGIK BAHARU & PEMBAIKAN JSON (DIGABUNGKAN DI SINI) ▼▼▼
				} else if (type === 'insert_record') {
                    const table = item.querySelector('.table-select')?.value;
                    const fields = Array.from(item.querySelectorAll('.field-value-pair')).map(pair => ({
                        field: pair.querySelector('.field-select')?.value,
                        value: pair.querySelector('.value-input')?.value
                    }));
                    itemData.table = table;
                    itemData.query = generateInsertQuery(table, fields);
                    itemData.details = { values: fields };
                } else if (type === 'update_record') {
                    const table = item.querySelector('.table-select')?.value;
                    const setClause = Array.from(item.querySelectorAll('.field-value-pair')).map(pair => ({
                        field: pair.querySelector('.field-select')?.value,
                        value: pair.querySelector('.value-input')?.value
                    }));
                    const whereClause = readWhereClauseState(item.querySelector('.where-clause-container'));
                    itemData.table = table;
                    itemData.query = generateUpdateQuery(table, setClause, whereClause);
                    itemData.details = { set: setClause, where: whereClause };
                } else if (type === 'delete_record') {
                    const table = item.querySelector('.table-select')?.value;
                    const whereClause = readWhereClauseState(item.querySelector('.where-clause-container'));
                    itemData.table = table;
                    itemData.query = generateDeleteQuery(table, whereClause);
                    itemData.details = { where: whereClause };
                // ▲▲▲ TAMAT LOGIK BAHARU ▲▲▲

                } else if (type === 'boolean') {
                    itemData.value = item.querySelector('select')?.value;
                } else if (['comparison_operator', 'logical_operator', 'arithmetic_operator', 'current_user', 'current_datetime'].includes(type)) {
                    itemData.value = item.querySelector('.operator-select')?.value;
                } else if (['string', 'number', 'api_endpoint'].includes(type)) {
                    itemData.value = item.querySelector('input')?.value;
                } else if (type === 'custom_query') {
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
        modalCanvasState = JSON.stringify(logicArray);
        if (placeholder) placeholder.style.display = logicArray.length === 0 ? 'block' : 'none';

        if (updateMode === 'live') {
            hiddenInput.value = modalCanvasState;
            hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };   
    const populateFieldsForChildMath = (componentEl) => {
        const fieldSelect = componentEl.querySelector('.field-select');
        if (!fieldSelect) return;

        const mainChildTable = componentEl.querySelector('.table-select').value;
        const joinRuleElements = componentEl.querySelectorAll('.cqb-join-rule .cqb-rule-table');
        const numericTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'];
        
        const tablesInvolved = new Set([mainChildTable]);
        joinRuleElements.forEach(select => tablesInvolved.add(select.value));
        
        const currentFieldValue = fieldSelect.value;
        fieldSelect.innerHTML = '';
        
        tablesInvolved.forEach(tableName => {
            const tableData = jsonData.database.table[tableName];
            if (tableData && tableData.fields) {
                for (const fieldName in tableData.fields) {
                    if (numericTypes.includes(tableData.fields[fieldName].data_type.toUpperCase())) {
                        const option = document.createElement('option');
                        const qualifiedName = `${tableName}.${fieldName}`;
                        option.value = qualifiedName;
                        option.textContent = qualifiedName;
                        fieldSelect.appendChild(option);
                    }
                }
            }
        });
        
        if (Array.from(fieldSelect.options).some(opt => opt.value === currentFieldValue)) {
            fieldSelect.value = currentFieldValue;
        }
    };
    
    const populateCanvasFromHiddenInput = () => {
        isRebuildingUI = true;
        try {
            const buildWhereClauseUI = (container, whereData, tableName) => {
                if (!container || !whereData) return;
                const logicRadio = container.querySelector(`.qb-logic-toggle input[value="${whereData.logic}"]`);
                if(logicRadio) logicRadio.checked = true;

                const rulesList = container.querySelector('.child-math-rules-list');
                const ruleTemplate = document.getElementById('where-clause-template');
                const fields = Object.keys(jsonData.database.table[tableName]?.fields || {});

                (whereData.rules || []).forEach(ruleData => {
                    const clone = ruleTemplate.content.cloneNode(true);
                    const ruleEl = clone.querySelector('.cqb-rule');
                    const fieldDropdown = ruleEl.querySelector('.cqb-rule-field');
                    fields.forEach(f => fieldDropdown.add(new Option(f, f)));
                    
                    fieldDropdown.value = ruleData.field;
                    ruleEl.querySelector('.cqb-rule-operator').value = ruleData.operator;
                    ruleEl.querySelector('.cqb-rule-value').value = ruleData.value;
                    
                    const operatorSelect = ruleEl.querySelector('.cqb-rule-operator');
                    const valueInput = ruleEl.querySelector('.cqb-rule-value');
                    if (valueInput) {
                        valueInput.classList.toggle('hidden', operatorSelect.value === 'IS NULL' || operatorSelect.value === 'IS NOT NULL');
                    }

                    rulesList.appendChild(ruleEl);
                });
            };
            
            const buildFromLogic = (container, logicArray) => {
                container.innerHTML = '';
                if (logicArray.length === 0 && container.classList.contains('algorithm-canvas')) {
                     if (placeholder) container.appendChild(placeholder);
                }
                logicArray.forEach(itemData => {
                    const newItem = createInteractiveElement(itemData);
                    container.appendChild(newItem);

                    if (itemData.type === 'field') {
                        newItem.querySelector('.table-select').value = itemData.table;
                        newItem.querySelector('.table-select').dispatchEvent(new Event('change'));
                        newItem.querySelector('.field-select').value = itemData.field;
                    } else if (itemData.type === 'lookup_value') {
                        newItem.querySelector('.table-select').value = itemData.table;
                        newItem.querySelector('.table-select').dispatchEvent(new Event('change'));
                        newItem.querySelector('.field-select').value = itemData.field;

                        if (itemData.condition) {
                            const showWhereBtn = newItem.querySelector('.show-lookup-where-btn');
                            if (showWhereBtn) showWhereBtn.click();
                            
                            const filterContainer = newItem.querySelector('.lookup-value-filter-container');
                            if (filterContainer) {
                                 const cond = itemData.condition;
                                 filterContainer.querySelector('.lookup-cond-external-field').value = cond.field;
                                 filterContainer.querySelector('.lookup-cond-operator').value = cond.operator;
                                 filterContainer.querySelector('.lookup-cond-value-type').value = cond.valueType;
                                 filterContainer.querySelector('.lookup-cond-value-type').dispatchEvent(new Event('change'));

                                 if (cond.valueType === 'static') {
                                    filterContainer.querySelector('.lookup-cond-static-value').value = cond.value;
                                 } else {
                                    filterContainer.querySelector('.lookup-cond-dynamic-value').value = cond.value;
                                 }
                            }
                        }
                    } else if (itemData.type === 'comment') {
                        newItem.querySelector('textarea').value = itemData.value;
                    } else if (itemData.type === 'this_record_data') {
                        newItem.querySelector('.field-select').value = itemData.field;
                    } else if (itemData.type === 'calculate_related_record' || itemData.type === 'related_record_data') {
                        const tableSelect = newItem.querySelector('.table-select');
                        tableSelect.value = itemData.table;
                        
                        // Bahagian untuk 'calculate_related_record'
                        if (itemData.type === 'calculate_related_record') {
                            const aggregateSelect = newItem.querySelector('.aggregate-select');
                            const fieldSelect = newItem.querySelector('.field-select');
                            aggregateSelect.value = itemData.aggregate;
                            tableSelect.dispatchEvent(new Event('change')); 
                            if (itemData.aggregate !== 'COUNT') {
                                fieldSelect.value = itemData.field;
                            }
                             updateChildMathUI(newItem);
                        }

                        // Bahagian untuk 'related_record_data'
                        if (itemData.type === 'related_record_data') {
                             const rel = jsonData.database.relationships.find(r => r.parent_table_name === context.tableName && r.child_table_name === itemData.table);
                             const fkField = rel ? rel.fk_child_field : '...';
                             const whereClause = newItem.querySelector('.where-clause');
                             if (whereClause) {
                                 whereClause.innerHTML = `WHERE \`${itemData.table}\`.\`${fkField}\` = ##ID##`;
                             }
                        }

                        // Bahagian penapis (dikongsi oleh kedua-dua komponen)
                        if (itemData.filter && itemData.filter.rules && itemData.filter.rules.length > 0) {
                            const showWhereBtn = newItem.querySelector('.show-where-btn');
                            if(showWhereBtn) {
                                showWhereBtn.classList.add('hidden');
                                const whereTemplate = document.getElementById('child-math-where-clause-template');
                                const whereClone = whereTemplate.content.cloneNode(true);
                                const filterContainer = whereClone.querySelector('.child-math-filter-container');
                                
                                const uniqueId = `logic_${Date.now()}`;
                                filterContainer.querySelectorAll('input[type="radio"]').forEach(radio => radio.name = `cqb-logic-${uniqueId}`);
                                
                                const actionsDiv = filterContainer.querySelector('.child-math-actions');
                                const joinBtn = document.createElement('button');
                                joinBtn.className = 'btn btn-secondary btn-sm add-child-join-rule-btn';
                                joinBtn.innerHTML = '<i class="fas fa-link"></i> +JOIN Rule';
                                actionsDiv.insertBefore(joinBtn, actionsDiv.querySelector('.remove-where-btn'));
                                
                                newItem.appendChild(filterContainer);
                            }

                            const filterContainer = newItem.querySelector('.child-math-filter-container');
                            if(filterContainer) {
                                const logicRadio = filterContainer.querySelector(`.qb-logic-toggle input[value="${itemData.filter.logic}"]`);
                                if(logicRadio) logicRadio.checked = true;

                                const rulesList = filterContainer.querySelector('.child-math-rules-list');
                                const ruleTemplate = document.getElementById('child-math-rule-template');
                                const joinRuleTemplate = document.getElementById('child-math-join-rule-template');

                                (itemData.filter.rules || []).forEach(ruleData => {
                                    if (ruleData.type === 'join_rule') {
                                        const clone = joinRuleTemplate.content.cloneNode(true);
                                        const ruleEl = clone.querySelector('.cqb-join-rule');
                                        rulesList.appendChild(ruleEl);
                                        
                                        const childTable = itemData.table;
                                        const relatedTables = new Set();
                                        jsonData.database.relationships.forEach(rel => {
                                            if (rel.parent_table_name === childTable) relatedTables.add(rel.child_table_name);
                                            if (rel.child_table_name === childTable) relatedTables.add(rel.parent_table_name);
                                        });
                                        const tableDropdown = ruleEl.querySelector('.cqb-rule-table');
                                        relatedTables.forEach(t => {
                                            tableDropdown.innerHTML += `<option value="${t}">${t}</option>`;
                                        });
                                        
                                        tableDropdown.value = ruleData.table;
                                        
                                        const fieldDropdown = ruleEl.querySelector('.cqb-rule-field');
                                        fieldDropdown.innerHTML = '';
                                        const fields = jsonData.database.table[ruleData.table]?.fields || {};
                                        Object.keys(fields).forEach(fName => {
                                            fieldDropdown.innerHTML += `<option value="${fName}">${fName}</option>`;
                                        });

                                        fieldDropdown.value = ruleData.field;
										const operatorDropdown = ruleEl.querySelector('.cqb-rule-operator');
										const valueInput = ruleEl.querySelector('.cqb-rule-value');
										operatorDropdown.value = ruleData.operator;
										valueInput.value = ruleData.value;

										if (valueInput) {
											valueInput.classList.toggle('hidden', ruleData.operator === 'IS NULL' || ruleData.operator === 'IS NOT NULL');
										}

                                    } else { // standard_rule
                                        const clone = ruleTemplate.content.cloneNode(true);
                                        const ruleEl = clone.querySelector('.cqb-rule');
                                        const fieldDropdown = ruleEl.querySelector('.cqb-rule-field');
                                        const childFields = jsonData.database.table[itemData.table]?.fields || {};
                                        Object.keys(childFields).forEach(fName => {
                                            fieldDropdown.innerHTML += `<option value="${fName}">${fName}</option>`;
                                        });
                                        fieldDropdown.value = ruleData.field;
										const operatorDropdown = ruleEl.querySelector('.cqb-rule-operator');
										const valueInput = ruleEl.querySelector('.cqb-rule-value');
										operatorDropdown.value = ruleData.operator;
										valueInput.value = ruleData.value;

										if (valueInput) {
											valueInput.classList.toggle('hidden', ruleData.operator === 'IS NULL' || ruleData.operator === 'IS NOT NULL');
										}
										rulesList.appendChild(ruleEl);
                                    }
                                });
                            }
                        }
                        
                        // ▼▼▼ PEMBETULAN UTAMA: URUTAN DIUBAH ▼▼▼
                        // Selepas bahagian penapis dibina, barulah kita mengisi senarai medan
                        if(itemData.type === 'calculate_related_record') {
                            populateFieldsForChildMath(newItem);
                        } else if (itemData.type === 'related_record_data') {
                            // 1. Panggil fungsi untuk mengisi senarai medan (kini ia boleh "melihat" jadual JOIN)
                            populateFieldsForRelatedData(newItem);
                            
                            // 2. Pilih semula medan yang disimpan
                            const fieldMultiSelect = newItem.querySelector('.field-multiselect');
                            (itemData.fields || []).forEach(fieldName => {
                                const option = fieldMultiSelect.querySelector(`option[value="${fieldName}"]`);
                                if (option) option.selected = true;
                            });
                        }
                        // ▲▲▲ TAMAT PEMBETULAN URUTAN ▲▲▲

                    }
                    else if (itemData.type === 'boolean' || ['comparison_operator', 'logical_operator', 'arithmetic_operator', 'current_user', 'current_datetime'].includes(itemData.type)) {
                        newItem.querySelector('select').value = itemData.value;
                    } else if (['string', 'number', 'api_endpoint'].includes(itemData.type)) {
                        newItem.querySelector('input').value = itemData.value;
                    } else if (itemData.type === 'custom_query') {
                        newItem.querySelector('textarea').value = itemData.value || '';
                        const stateInput = newItem.querySelector('.query-builder-state');
                        if (stateInput && itemData.builder_state) {
                            stateInput.value = itemData.builder_state;
                        }
                    }
                    // ▼▼▼ MERGED CASES FOR DATABASE ACTIONS ▼▼▼
// ▼▼▼ ...DENGAN BLOK `if` YANG BAHARU INI ▼▼▼
                    if (['insert_record', 'update_record', 'delete_record'].includes(itemData.type)) {
                        const tableSelect = newItem.querySelector('.table-select');
                        tableSelect.value = itemData.table;
                        const fields = Object.keys(jsonData.database.table[itemData.table]?.fields || {});
                        
                        if (itemData.type !== 'delete_record' && itemData.details) {
                            const list = newItem.querySelector('.field-value-list');
                            const pairTemplate = document.getElementById('field-value-pair-template');
                            const dataList = itemData.type === 'insert_record' ? itemData.details.values : itemData.details.set;

                            (dataList || []).forEach(pairData => {
                                const pairClone = pairTemplate.content.cloneNode(true);
                                const fieldSelect = pairClone.querySelector('.field-select');
                                fields.forEach(f => fieldSelect.add(new Option(f, f)));
                                fieldSelect.value = pairData.field;
                                pairClone.querySelector('.value-input').value = pairData.value;
                                list.appendChild(pairClone);
                            });
                        }
                        
                        if (itemData.type !== 'insert_record' && itemData.details?.where) {
                            buildWhereClauseUI(newItem.querySelector('.where-clause-container'), itemData.details.where, itemData.table);
                        }
                    } else if (itemData.type === 'function' && itemData.arguments) {
                        const argContainer = newItem.querySelector('.function-argument-droppable');
                        buildFromLogic(argContainer, itemData.arguments);
                    }
                });
            };

            const currentLogicValue = hiddenInput.value || '[]';
            const logic = JSON.parse(currentLogicValue);
            buildFromLogic(canvas, logic);
        } catch (e) {
            console.error("Gagal memuat semula kanvas dari state:", e);
        } finally {
            isRebuildingUI = false;
        }
    };
    
    const createInteractiveElement = (data) => {
        const type = data.type;
        let itemContainer = document.createElement('div');
        itemContainer.className = 'dropped-item';
        itemContainer.dataset.itemType = type;
        const VALUE_TYPES_FOR_WRAPPING = ['field', 'this_record_data', 'calculate_related_record', 'related_record_data', 'lookup_value', 'string', 'number', 'custom_query', 'api_endpoint', 'boolean', 'null', 'current_user', 'current_datetime', 'function'];
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
case 'custom_query': {
    itemContainer.innerHTML = `<div class="sql-query-header">
        <span>[SQL QUERY]</span>
        <div class="header-buttons">
            <button class="btn btn-secondary btn-sm open-qh-btn" title="Open Query Helper">
                <i class="fas fa-magic"></i> Query Helper
            </button>
        </div>
    </div>
    <textarea placeholder="SELECT ..."></textarea>
    <input type="hidden" class="query-builder-state">`;

    const textarea = itemContainer.querySelector('textarea');
    textarea.addEventListener('input', updateModalCanvasState);

    // Event listener untuk Query Helper
    itemContainer.querySelector('.open-qh-btn').addEventListener('click', () => {
        openQueryHelperModal({
            targetTextarea: textarea,
            context: context // 'context' diwarisi dari skop fungsi setupLogicBuilderCore
        });
    });
    break;
}
            case 'api_endpoint':
                itemContainer.innerHTML = `<span class="api-endpoint-label">[API ENDPOINT]</span><input type="text" placeholder="https://api.example.com/data">`;
                itemContainer.querySelector('input').addEventListener('input', updateModalCanvasState);
                break;            
            case 'lookup_value': {
                itemContainer.classList.add('child-math-style');
                const mainQueryContainer = document.createElement('div');
                mainQueryContainer.className = 'child-math-main-query'; 
                mainQueryContainer.innerHTML = `
                    <span class="sql-keyword">SELECT</span>
                    <select class="field-select"></select>
                    <span class="sql-prose">FROM</span>
                    <select class="table-select"></select>
                `;
                itemContainer.appendChild(mainQueryContainer);
                
                const tableSelect = mainQueryContainer.querySelector('.table-select');
                const fieldSelect = mainQueryContainer.querySelector('.field-select');
                
                const activeTable = config.context?.tableName || '';
                const allOtherTables = Object.keys(jsonData.database.table).filter(t => t !== activeTable);
                allOtherTables.forEach(tableName => {
                    const option = document.createElement('option');
                    option.value = tableName;
                    option.textContent = tableName;
                    tableSelect.appendChild(option);
                });

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
                    const existingFilter = itemContainer.querySelector('.lookup-value-filter-container');
                    if(existingFilter) existingFilter.remove();
                    itemContainer.querySelector('.show-lookup-where-btn').classList.remove('hidden');
                    updateModalCanvasState();
                });
                fieldSelect.addEventListener('change', updateModalCanvasState);
                
                if (allOtherTables.length > 0) {
                     populateFields(allOtherTables[0]);
                }

                const showWhereBtn = document.createElement('button');
                showWhereBtn.className = 'btn btn-secondary btn-sm show-lookup-where-btn';
                showWhereBtn.innerHTML = '<i class="fas fa-plus"></i> WHERE';
                itemContainer.appendChild(showWhereBtn);

                break;
            }
            case 'this_record_data': {
                const activeTable = context?.tableName || '';
                const fields = jsonData.database.table[activeTable]?.fields || {};
                const fieldNames = Object.keys(fields);
                const pkFieldName = fieldNames.find(f => fields[f].primary_key === 1) || 'id';

                const selectLabel = document.createElement('span');
                selectLabel.textContent = 'SELECT';
                selectLabel.className = 'sql-keyword';
                itemContainer.appendChild(selectLabel);

                const fieldSelect = document.createElement('select');
                fieldSelect.className = 'field-select';
                
                fieldNames.forEach(fieldName => {
                    const option = document.createElement('option');
                    option.value = fieldName;
                    option.textContent = fieldName;
                    fieldSelect.appendChild(option);
                });
                itemContainer.appendChild(fieldSelect);
                fieldSelect.addEventListener('change', updateModalCanvasState);

                const fromClause = document.createElement('span');
                fromClause.innerHTML = `FROM <strong class="sql-table-name">${activeTable}</strong> WHERE <strong class="sql-condition">${pkFieldName} = ##ID##</strong>`;
                fromClause.className = 'sql-prose';
                itemContainer.appendChild(fromClause);
                
                itemContainer.style.justifyContent = 'flex-start';
                break;
            }
            case 'calculate_related_record': {
                const parentTable = context?.tableName || '';
                const childRelationships = jsonData.database.relationships.filter(r => r.parent_table_name === parentTable);
                
                itemContainer.classList.add('child-math-style');
                const mainQueryContainer = document.createElement('div');
                mainQueryContainer.className = 'child-math-main-query';
                mainQueryContainer.innerHTML = `
                    <span class="sql-keyword">SELECT</span>
                    <select class="aggregate-select">
                        <option>SUM</option><option>AVG</option><option>COUNT</option><option>MIN</option><option>MAX</option>
                    </select>
                    <select class="field-select"></select>
                    <span class="count-star hidden">*</span>
                    <span class="sql-prose">FROM</span>
                    <select class="table-select"></select>
                    <span class="sql-prose where-clause"></span>
                `;
                itemContainer.appendChild(mainQueryContainer);
                
                const showWhereBtn = document.createElement('button');
                showWhereBtn.className = 'btn btn-secondary btn-sm show-where-btn';
                showWhereBtn.innerHTML = '<i class="fas fa-plus"></i> WHERE';
                itemContainer.appendChild(showWhereBtn);

                const aggregateSelect = itemContainer.querySelector('.aggregate-select');
                const fieldSelect = itemContainer.querySelector('.field-select');
                const tableSelect = itemContainer.querySelector('.table-select');
                const countStar = itemContainer.querySelector('.count-star');
                const whereClause = itemContainer.querySelector('.where-clause');

                if (childRelationships.length > 0) {
                    childRelationships.forEach(rel => {
                        tableSelect.innerHTML += `<option value="${rel.child_table_name}">${rel.child_table_name}</option>`;
                    });
                } else {
                    tableSelect.innerHTML = `<option value="">No child tables</option>`;
                    tableSelect.disabled = true;
                    aggregateSelect.disabled = true;
                }
                
                tableSelect.addEventListener('change', () => {
                    const selectedChildTable = tableSelect.value;
                    const rel = childRelationships.find(r => r.child_table_name === selectedChildTable);
                    
                    populateFieldsForChildMath(itemContainer);
                    whereClause.innerHTML = `WHERE \`${selectedChildTable}\`.\`${rel ? rel.fk_child_field : '...'}\` = ##ID##`;
                    
                    const existingFilter = itemContainer.querySelector('.child-math-filter-container');
                    if(existingFilter) existingFilter.remove();
                    showWhereBtn.classList.remove('hidden');

                    updateModalCanvasState();
                });

                aggregateSelect.addEventListener('change', () => {
                    updateChildMathUI(itemContainer);
                    updateModalCanvasState();
                });
                
                fieldSelect.addEventListener('change', updateModalCanvasState);

                showWhereBtn.addEventListener('click', () => {
                    showWhereBtn.classList.add('hidden');
                    const template = document.getElementById('child-math-where-clause-template');
                    const clone = template.content.cloneNode(true);
                    const filterContainer = clone.querySelector('.child-math-filter-container');
                    
                    const uniqueId = `logic_${Date.now()}`;
                    filterContainer.querySelectorAll('input[type="radio"]').forEach(radio => radio.name = `cqb-logic-${uniqueId}`);
                    
                    const actionsDiv = filterContainer.querySelector('.child-math-actions');
                    const joinBtn = document.createElement('button');
                    joinBtn.className = 'btn btn-secondary btn-sm add-child-join-rule-btn';
                    joinBtn.innerHTML = '<i class="fas fa-link"></i> +JOIN Rule';
                    actionsDiv.insertBefore(joinBtn, actionsDiv.querySelector('.remove-where-btn'));
                    
                    itemContainer.appendChild(filterContainer);
                });

                if (childRelationships.length > 0) {
                    tableSelect.dispatchEvent(new Event('change'));
                }
                break;
            }
            case 'related_record_data': {
                const parentTable = context?.tableName || '';
                const childRelationships = jsonData.database.relationships.filter(r => r.parent_table_name === parentTable);

                itemContainer.classList.add('child-math-style'); 

                const mainQueryContainer = document.createElement('div');
                mainQueryContainer.className = 'child-math-main-query';
                mainQueryContainer.innerHTML = `
                    <span class="sql-keyword">SELECT</span>
                    <select class="field-multiselect" multiple></select>
                    <span class="sql-prose">FROM</span>
                    <select class="table-select"></select>
                    <span class="sql-prose where-clause"></span>
                `;
                itemContainer.appendChild(mainQueryContainer);

                const showWhereBtn = document.createElement('button');
                showWhereBtn.className = 'btn btn-secondary btn-sm show-where-btn';
                showWhereBtn.innerHTML = '<i class="fas fa-plus"></i> WHERE';
                itemContainer.appendChild(showWhereBtn);

                const tableSelect = itemContainer.querySelector('.table-select');
                const fieldMultiSelect = itemContainer.querySelector('.field-multiselect');
                const whereClause = itemContainer.querySelector('.where-clause');

                if (childRelationships.length > 0) {
                    childRelationships.forEach(rel => {
                        tableSelect.innerHTML += `<option value="${rel.child_table_name}">${rel.child_table_name}</option>`;
                    });
                } else {
                    tableSelect.innerHTML = `<option value="">No child tables</option>`;
                    tableSelect.disabled = true;
                }
                
                tableSelect.addEventListener('change', () => {
                    const selectedChildTable = tableSelect.value;
                    const rel = childRelationships.find(r => r.child_table_name === selectedChildTable);
                    
                    populateFieldsForRelatedData(itemContainer); 
                    
                    whereClause.innerHTML = `WHERE \`${selectedChildTable}\`.\`${rel ? rel.fk_child_field : '...'}\` = ##ID##`;
                    
                    const existingFilter = itemContainer.querySelector('.child-math-filter-container');
                    if(existingFilter) existingFilter.remove();
                    showWhereBtn.classList.remove('hidden');

                    if (!isRebuildingUI) {
                        updateModalCanvasState();
                    }
                });

                fieldMultiSelect.addEventListener('change', updateModalCanvasState);

                showWhereBtn.addEventListener('click', () => {
                    showWhereBtn.classList.add('hidden');
                    const template = document.getElementById('child-math-where-clause-template');
                    const clone = template.content.cloneNode(true);
                    const filterContainer = clone.querySelector('.child-math-filter-container');
                    
                    const uniqueId = `logic_${Date.now()}`;
                    filterContainer.querySelectorAll('input[type="radio"]').forEach(radio => radio.name = `cqb-logic-${uniqueId}`);
                    
                    const actionsDiv = filterContainer.querySelector('.child-math-actions');
                    const joinBtn = document.createElement('button');
                    joinBtn.className = 'btn btn-secondary btn-sm add-child-join-rule-btn';
                    joinBtn.innerHTML = '<i class="fas fa-link"></i> +JOIN Rule';
                    actionsDiv.insertBefore(joinBtn, actionsDiv.querySelector('.remove-where-btn'));
                    
                    itemContainer.appendChild(filterContainer);
                });
                
                if (childRelationships.length > 0) {
                    tableSelect.dispatchEvent(new Event('change'));
                }
                break;
            }
            case 'field':
                const tableSelect = document.createElement('select');
                tableSelect.className = 'table-select';
                let activeTable = '';
                if (context && context.tableName) {
                    activeTable = context.tableName;
                } else {
                    const fieldNameElement = document.querySelector('#field-settings-page .field-name');
                    if (fieldNameElement) {
                        [activeTable] = fieldNameElement.textContent.split('.');
                    }
                }
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
                    { value: '=', text: 'matched' },
                    { value: '!=', text: 'unmatched' },
                    { value: '>', text: 'above' },
                    { value: '<', text: 'below' },
                    { value: '>=', text: 'at least' },
                    { value: '<=', text: 'at most' },
                    { value: 'LIKE', text: 'contains' },
                    { value: 'NOT LIKE', text: 'without' },
                    { value: 'IN', text: 'among(a,b,c)' },
                    { value: 'NOT IN', text: 'outside(a,b,c)' },
                    { value: 'IS NULL', text: 'is empty' },
                    { value: 'IS NOT NULL', text: 'has content' }
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
                propertySelect.className = 'operator-select';
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
                propertySelect.className = 'operator-select';
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
        // ▼▼▼ TAMBAH/GANTIKAN KOD UNTUK 'case number' ▼▼▼
        case 'number':
            const numberInput = document.createElement('input');
            numberInput.type = 'number';
            numberInput.step = 'any'; // Membenarkan nombor perpuluhan (float)
            numberInput.placeholder = '0';
            numberInput.addEventListener('input', updateModalCanvasState);
            itemContainer.appendChild(numberInput);
            break;
            // ▼▼▼ MERGED CASES FOR DATABASE ACTIONS ▼▼▼
            case 'insert_record': {
                const template = document.getElementById('db-action-insert-template');
                itemContainer.appendChild(template.content.cloneNode(true));
                const tableSelect = itemContainer.querySelector('.table-select');
                Object.keys(jsonData.database.table).forEach(t => tableSelect.add(new Option(t, t)));
                break;
            }
            case 'update_record': {
                const template = document.getElementById('db-action-update-template');
                itemContainer.appendChild(template.content.cloneNode(true));
                const tableSelect = itemContainer.querySelector('.table-select');
                Object.keys(jsonData.database.table).forEach(t => tableSelect.add(new Option(t, t)));
                const uniqueId = `logic_${Date.now()}`;
                itemContainer.querySelectorAll('input[type="radio"]').forEach(radio => radio.name = `cqb-logic-${uniqueId}`);
                break;
            }
            case 'delete_record': {
                const template = document.getElementById('db-action-delete-template');
                itemContainer.appendChild(template.content.cloneNode(true));
                const tableSelect = itemContainer.querySelector('.table-select');
                Object.keys(jsonData.database.table).forEach(t => tableSelect.add(new Option(t, t)));
                const uniqueId = `logic_${Date.now()}`;
                itemContainer.querySelectorAll('input[type="radio"]').forEach(radio => radio.name = `cqb-logic-${uniqueId}`);
                break;
            }
            // ▲▲▲ END OF DB ACTION CASES ▲▲▲
			
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

    const VALUE_TYPES = ['field', 'this_record_data', 'calculate_related_record', 'related_record_data', 'lookup_value', 'string', 'number', 'custom_query', 'api_endpoint', 'boolean', 'null', 'current_user', 'current_datetime', 'function'];
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
    // ▼▼▼ MERGED & CORRECTED EVENT LISTENERS for canvas ▼▼▼
    canvas.addEventListener('click', (e) => {
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
        
        const childMathItem = e.target.closest('.dropped-item[data-item-type="calculate_related_record"], .dropped-item[data-item-type="related_record_data"]');

        if (childMathItem) {
            if (e.target.matches('.add-child-rule-btn, .add-child-rule-btn *')) {
                const rulesList = childMathItem.querySelector('.child-math-rules-list');
                const ruleTemplate = document.getElementById('child-math-rule-template');
                const clone = ruleTemplate.content.cloneNode(true);
                
                const childTable = childMathItem.querySelector('.table-select').value;
                const childFields = jsonData.database.table[childTable]?.fields || {};
                const fieldDropdown = clone.querySelector('.cqb-rule-field');
                Object.keys(childFields).forEach(fName => {
                    fieldDropdown.innerHTML += `<option value="${fName}">${fName}</option>`;
                });

                rulesList.appendChild(clone);
                updateModalCanvasState();
            }

            if (e.target.matches('.add-child-join-rule-btn, .add-child-join-rule-btn *')) {
                const rulesList = childMathItem.querySelector('.child-math-rules-list');
                const ruleTemplate = document.getElementById('child-math-join-rule-template');
                const clone = ruleTemplate.content.cloneNode(true);
                const ruleEl = clone.querySelector('.cqb-join-rule');

                const childTable = childMathItem.querySelector('.table-select').value;
                const relatedTables = new Set();
                jsonData.database.relationships.forEach(rel => {
                    if (rel.parent_table_name === childTable) relatedTables.add(rel.child_table_name);
                    if (rel.child_table_name === childTable) relatedTables.add(rel.parent_table_name);
                });

                const tableDropdown = ruleEl.querySelector('.cqb-rule-table');
                const fieldDropdown = ruleEl.querySelector('.cqb-rule-field');

                relatedTables.forEach(t => tableDropdown.innerHTML += `<option value="${t}">${t}</option>`);

                const populateJoinFields = (selectedTable) => {
                    fieldDropdown.innerHTML = '';
                    const fields = jsonData.database.table[selectedTable]?.fields || {};
                    Object.keys(fields).forEach(fName => {
                        fieldDropdown.innerHTML += `<option value="${fName}">${fName}</option>`;
                    });
                };
                
                tableDropdown.addEventListener('change', () => {
                    populateJoinFields(tableDropdown.value);
                    if(childMathItem.dataset.itemType === 'calculate_related_record') {
                         populateFieldsForChildMath(childMathItem);
                    } else if (childMathItem.dataset.itemType === 'related_record_data') {
                         populateFieldsForRelatedData(childMathItem);
                    }
                    updateModalCanvasState();
                });

                if (relatedTables.size > 0) {
                    populateJoinFields(tableDropdown.value);
                }
                
                rulesList.appendChild(clone);
                
                if(childMathItem.dataset.itemType === 'calculate_related_record') {
                     populateFieldsForChildMath(childMathItem);
                } else if (childMathItem.dataset.itemType === 'related_record_data') {
                     populateFieldsForRelatedData(childMathItem);
                }
                updateModalCanvasState();
            }

            if (e.target.matches('.remove-where-btn, .remove-where-btn *')) {
                childMathItem.querySelector('.child-math-filter-container')?.remove();
                childMathItem.querySelector('.show-where-btn')?.classList.remove('hidden');
                updateModalCanvasState();
            }

            if (e.target.matches('.cqb-delete-btn, .cqb-delete-btn *')) {
                const ruleEl = e.target.closest('.cqb-rule, .cqb-join-rule');
                if (ruleEl) {
                    const wasJoinRule = ruleEl.classList.contains('cqb-join-rule');
                    ruleEl.remove();

                    if(wasJoinRule) {
                        if(childMathItem.dataset.itemType === 'calculate_related_record') {
                            populateFieldsForChildMath(childMathItem);
                        } else if (childMathItem.dataset.itemType === 'related_record_data') {
                            populateFieldsForRelatedData(childMathItem);
                        }
                    }
                    updateModalCanvasState();
                }
            }
        }

        const lookupItem = e.target.closest('.dropped-item[data-item-type="lookup_value"]');
        if (lookupItem) {
            if (e.target.matches('.show-lookup-where-btn, .show-lookup-where-btn *')) {
                e.target.closest('.show-lookup-where-btn').classList.add('hidden');
                const template = document.getElementById('lookup-value-where-clause-template');
                const clone = template.content.cloneNode(true);
                const filterContainer = clone.querySelector('.lookup-value-filter-container');

                const externalFieldSelect = filterContainer.querySelector('.lookup-cond-external-field');
                const dynamicValueSelect = filterContainer.querySelector('.lookup-cond-dynamic-value');
                
                const externalTableName = lookupItem.querySelector('.table-select').value;
                const currentTableName = context.tableName;

                Object.keys(jsonData.database.table[externalTableName].fields).forEach(f => {
                    externalFieldSelect.innerHTML += `<option value="${f}">${f}</option>`;
                });

                Object.keys(jsonData.database.table[currentTableName].fields).forEach(f => {
                    dynamicValueSelect.innerHTML += `<option value="##current_record.${f}##">${f}</option>`;
                });

                filterContainer.querySelector('.lookup-cond-value-type').addEventListener('change', (ev) => {
                    const isStatic = ev.target.value === 'static';
                    filterContainer.querySelector('#lookup-cond-static-value-group').classList.toggle('hidden', !isStatic);
                    filterContainer.querySelector('#lookup-cond-dynamic-value-group').classList.toggle('hidden', isStatic);
                    updateModalCanvasState();
                });
                
                lookupItem.appendChild(filterContainer);
                updateModalCanvasState();
            }

            if (e.target.matches('.remove-lookup-where-btn, .remove-lookup-where-btn *')) {
                lookupItem.querySelector('.lookup-value-filter-container')?.remove();
                lookupItem.querySelector('.show-lookup-where-btn')?.classList.remove('hidden');
                updateModalCanvasState();
            }
        }		
        const item = e.target.closest('.dropped-item[data-item-type$="_record"]');
        if (!item) return;

        // Add Field button for INSERT/UPDATE
        if (e.target.matches('.add-field-btn, .add-field-btn *')) {
            const list = item.querySelector('.field-value-list');
            const table = item.querySelector('.table-select').value;
            if (!table || !jsonData.database.table[table]) return;

            // BUG FIX #3: Prevent duplicate fields
            const usedFields = new Set(Array.from(list.querySelectorAll('.field-select')).map(sel => sel.value));
            const availableFields = Object.keys(jsonData.database.table[table].fields).filter(f => !usedFields.has(f));

            if (availableFields.length === 0) {
                showCustomDialog({title: "Info", message: "All fields for this table have been added."});
                return;
            }

            const template = document.getElementById('field-value-pair-template');
            const clone = template.content.cloneNode(true);
            const fieldSelect = clone.querySelector('.field-select');
            availableFields.forEach(f => fieldSelect.add(new Option(f, f)));
            
            list.appendChild(clone);
            updateModalCanvasState();
        }

        // Delete button for a field-value pair
        if (e.target.matches('.delete-pair-btn')) {
            e.target.closest('.field-value-pair').remove();
            updateModalCanvasState();
        }

        // BUG FIX #1: Add WHERE rule button for UPDATE/DELETE
        if (e.target.matches('.add-child-rule-btn, .add-child-rule-btn *')) {
            const rulesList = item.querySelector('.child-math-rules-list');
            const table = item.querySelector('.table-select').value;
            if (!rulesList || !table) return;

            const ruleTemplate = document.getElementById('where-clause-template');
            const clone = ruleTemplate.content.cloneNode(true);
            const fieldDropdown = clone.querySelector('.cqb-rule-field');
            const fields = Object.keys(jsonData.database.table[table]?.fields || {});
            fields.forEach(fName => fieldDropdown.add(new Option(fName, fName)));
            
            rulesList.appendChild(clone);
            updateModalCanvasState();
        }

        // Delete button for a WHERE rule
        if (e.target.matches('.cqb-delete-btn')) {
            e.target.closest('.cqb-rule').remove();
            updateModalCanvasState();
        }
    });

    
    canvas.addEventListener('change', e => {
        if(e.target.closest('.child-math-filter-container, .lookup-value-filter-container')) {
            updateModalCanvasState();
        }
        
        if (e.target.matches('.cqb-join-rule .cqb-rule-table')) {
            const childMathItem = e.target.closest('.dropped-item[data-item-type="calculate_related_record"], .dropped-item[data-item-type="related_record_data"]');
            if(childMathItem) {
                if (childMathItem.dataset.itemType === 'calculate_related_record') {
                    populateFieldsForChildMath(childMathItem);
                } else if (childMathItem.dataset.itemType === 'related_record_data') {
                    populateFieldsForRelatedData(childMathItem);
                }
                updateModalCanvasState();
            }
        }        
        if (e.target.matches('.cqb-rule-operator')) {
            const ruleEl = e.target.closest('.cqb-rule, .cqb-join-rule');
            if (ruleEl) {
                const valueInput = ruleEl.querySelector('.cqb-rule-value');
                const operator = e.target.value;
                if (valueInput) {
                    valueInput.classList.toggle('hidden', operator === 'IS NULL' || operator === 'IS NOT NULL');
                }
            }
        }
		
        const item = e.target.closest('.dropped-item[data-item-type$="_record"]');
        if (item && e.target.matches('.table-select')) {
            const table = e.target.value;
            if (!table || !jsonData.database.table[table]) return;

            const fields = Object.keys(jsonData.database.table[table].fields);

            if (item.querySelector('.field-value-list')) {
                item.querySelector('.field-value-list').innerHTML = '';
            }
            if (item.querySelector('.child-math-rules-list')) {
                 item.querySelector('.child-math-rules-list').innerHTML = '';
            }
            updateModalCanvasState();
        }

        if(item) {
             updateModalCanvasState();
        }
    });

    populateCanvasFromHiddenInput();
	updateModalCanvasState();

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
// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

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

    // Sembunyikan semua komponen dan kumpulan secara lalai dahulu
    const allComponents = ui.palette.querySelectorAll('.algo-component');
    const allGroups = ui.palette.querySelectorAll('.palette-group');
    allComponents.forEach(comp => comp.style.display = 'none');
    allGroups.forEach(group => group.style.display = 'none');

    // Tentukan komponen mana yang perlu dipaparkan
    let componentsToShow = [];
    if (config.allowedComponents && Array.isArray(config.allowedComponents)) {
        componentsToShow = config.allowedComponents;
    } else {
        const hiddenComponents = config.hiddenComponents || [];
        allComponents.forEach(comp => {
            if (!hiddenComponents.includes(comp.dataset.type)) {
                componentsToShow.push(comp.dataset.type);
            }
        });
    }

    // Paparkan hanya komponen yang dibenarkan
    componentsToShow.forEach(type => {
        const componentEl = ui.palette.querySelector(`.algo-component[data-type="${type}"]`);
        if (componentEl) {
            componentEl.style.display = 'flex';
        }
    });

    // ▼▼▼ MULA BLOK LOGIK YANG TELAH DIPERBAIKI ▼▼▼
    // Paparkan semula kumpulan JIKA ia mempunyai komponen yang kelihatan ATAU jika ia adalah 'legend' yang perlu dipaparkan
    allGroups.forEach(group => {
        // KES KHAS: Uruskan paparan dan pengisian 'legend' pembolehubah
        if (group.id === 'variable-legend-container') {
            if (config.showVariableLegend) {
                group.style.display = 'block'; // Tunjukkan bekas utama

                const defaultVarsContainer = ui.palette.querySelector('#legend-default-vars');
                const userVarsContainer = ui.palette.querySelector('#legend-user-vars');
                const userVarsSection = ui.palette.querySelector('#legend-user-vars-section');

                if (defaultVarsContainer) defaultVarsContainer.innerHTML = '';
                if (userVarsContainer) userVarsContainer.innerHTML = '';
                
                const defaultVars = ['##ID##', '##USERNAME##', '##GROUPID##', '##GROUP##', '##NOW##'];
                defaultVars.forEach(v => {
                    const li = document.createElement('li');
                    li.innerHTML = `<code>${v}</code>`;
                    defaultVarsContainer.appendChild(li);
                });

                if (config.availableVariables && config.availableVariables.length > 0) {
                    userVarsSection.style.display = 'block';
                    config.availableVariables.forEach(v => {
                        const li = document.createElement('li');
                        li.innerHTML = `<code>##variable.${v}##</code>`;
                        userVarsContainer.appendChild(li);
                    });
                } else {
                    userVarsSection.style.display = 'none';
                }
            }
        } 
        // Logik asal untuk semua kumpulan komponen yang lain
        else {
            const visibleChild = group.querySelector('.algo-component[style*="display: flex"]');
            if (visibleChild) {
                group.style.display = 'block';
            }
        }
    });
    // ▲▲▲ TAMAT BLOK LOGIK YANG TELAH DIPERBAIKI ▲▲▲

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

export function initializeStackSelectorHandlers() {
    const baseStackSelect = document.getElementById('app-stack_base');
    const detailGroups = document.querySelectorAll('.stack-detail-group');
    const descriptionContainer = document.getElementById('stack-description-container');

    // Object containing all descriptions
    const stackDescriptions = {
        'core_php': 'A foundational stack using native PHP, Bootstrap for styling, and jQuery for client-side scripting. Ideal for simple, fast-loading applications without a complex framework.',
        'laravel_filament': 'A powerful combination using the Laravel framework with the Filament admin panel, which is built on the modern TALL stack (Tailwind CSS, Alpine.js, Livewire, Laravel).',
        'laravel_backpack': 'Uses the robust Laravel framework paired with the Backpack for Laravel admin panel, which leverages the classic Bootstrap and jQuery ecosystem for rapid development.',
        'ci4': 'A modern, lightweight PHP framework. CodeIgniter 4 is known for its speed, small footprint, and clear documentation, making it great for building full-featured web applications.',
        'ci3': 'The legacy version of the popular CodeIgniter framework. It remains a stable and reliable choice for many existing applications and developers familiar with its architecture.',
        'appgini': 'A low-code development tool that generates PHP applications from a MySQL database, enabling extremely fast creation of data-driven web apps.',
        'wordpress': "The world's most popular content management system (CMS). Built on PHP and MySQL, it's highly extensible with a vast ecosystem of plugins and themes.",
        'django': 'A high-level Python web framework that encourages rapid development and clean, pragmatic design. It follows the "batteries-included" philosophy, providing most common functionalities out of the box.',
        'flask': 'A Python microframework that provides the essentials for web development, giving developers the flexibility to choose their own tools and libraries for other tasks.',
        'aspnet_core': 'A cross-platform, high-performance, open-source framework by Microsoft for building modern, cloud-based, and Internet-connected applications with C#.',
        'ror': 'A server-side web application framework written in Ruby. Rails follows the model–view–controller (MVC) pattern, emphasizing convention over configuration to increase developer productivity.',
        'java_spring': 'A powerful Java-based framework for creating stand-alone, production-grade web applications. It focuses on simplicity, productivity, and solving enterprise-level problems.',
        'java_struts': 'An open-source MVC framework for creating elegant, modern Java web applications. It favors convention over configuration and is known for its robustness in enterprise environments.',
        'mean': 'A full-stack JavaScript solution for building fast, robust web applications. It comprises MongoDB (database), Express.js (backend), Angular (frontend), and Node.js (runtime).',
        'mern': 'Similar to the MEAN stack, but with React as the frontend library instead of Angular. It is one of the most popular stacks for building modern single-page applications.',
        'mevn': 'Another variation of the popular JavaScript stack, using Vue.js as its frontend framework. Vue is known for its gentle learning curve and high performance.',
        'pern': 'A powerful alternative to the MERN/MEAN stack that replaces the NoSQL MongoDB database with the relational PostgreSQL database, ideal for applications requiring complex queries and data integrity.'
    };

    const updateStackDetails = () => {
        if (!baseStackSelect) return;

        const selectedOption = baseStackSelect.selectedOptions[0];
        if (!selectedOption) return;
        
        const selectedValue = selectedOption.value;
        const selectedGroup = selectedOption.dataset.stackGroup;
        
        // Update description text
        if (descriptionContainer) {
            descriptionContainer.innerHTML = stackDescriptions[selectedValue] || '';
        }
        
        // Hide all detail groups first
        detailGroups.forEach(group => group.style.display = 'none');

        // Then, show only the relevant ones
        detailGroups.forEach(group => {
            const refGroups = group.dataset.stackRef.split(' ');
            if (refGroups.includes(selectedGroup)) {
                group.style.display = 'block';
            }
        });

        // Rename the visible selects to be included in the save logic
        document.querySelectorAll('.app-stack-database, .app-stack-theme').forEach(select => {
            if (select.closest('.stack-detail-group').style.display !== 'none') {
                 if(select.classList.contains('app-stack-database')) select.id = 'app-stack-database';
                 if(select.classList.contains('app-stack-theme')) select.id = 'app-stack-theme';
            } else {
                select.id = ''; // Remove ID to exclude from saving
            }
        });
    };

    if (baseStackSelect) {
        baseStackSelect.addEventListener('change', updateStackDetails);
        // Initial call to set the correct view on load
        updateStackDetails();
    }
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
        
        // Jika jadual induk dipilih, lakukan 'upsert'.
        // Jika pilihan dikosongkan, ia bermaksud memadam hubungan.
        if (parentTableName) {
            SaveManager.addToQueue('upsertRelationship', null, {
                parentTableName,
                childTableName,
                fk_child_field
            });
        } else {
            // Hantar tugasan untuk memadam hubungan.
            SaveManager.addToQueue('deleteRelationship', null, {
                childTableName,
                fk_child_field
            });
        }
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

        // Untuk perubahan selain nama jadual, backend memerlukan nama jadual semasa
        // untuk konteks. Ralat "Missing named parameter 'table_name'" menunjukkan perkara ini.
        if (key !== 'table_name') {
            dataToSave.table_name = tableName;
        }

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

// ▼▼▼ FUNGSI BANTUAN BAHARU: Mengemas kini keadaan butang naik/turun untuk item di dalam kumpulan ▼▼▼
function updateNestedMoveButtonStates(container) {
    if (!container) return;
    const items = container.querySelectorAll('.nested-menu-item');
    items.forEach((item, index) => {
        const upBtn = item.querySelector('.nested-menu-move-up-btn');
        const downBtn = item.querySelector('.nested-menu-move-down-btn');
        if (upBtn) upBtn.disabled = (index === 0);
        if (downBtn) downBtn.disabled = (index === items.length - 1);
    });
}
// ▲▲▲ TAMAT FUNGSI BANTUAN BAHARU ▲▲▲

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

    // Tab: Web Development Stack
    setElementValue('app-stack_base', projectData.stack_base || 'core_php');
    // Trigger change to show correct dependent fields
    const stackSelect = document.getElementById('app-stack_base');
    if (stackSelect) {
        stackSelect.dispatchEvent(new Event('change'));
    }
    // Now set the values for the visible selects
    const dbSelect = document.getElementById('app-stack-database');
    const themeSelect = document.getElementById('app-stack-theme');
    if(dbSelect) setElementValue('app-stack-database', projectData.stack_database);
    if(themeSelect) setElementValue('app-stack-theme', projectData.stack_theme);
	
	setElementValue('app-module-auth-email-2fa', projectData.module_auth_email_2fa);
    setElementValue('app-module-auth-email-captcha', projectData.module_auth_email_captcha);
    setElementValue('app-module-auth-ldap', projectData.module_auth_ldap);
    setElementValue('app-module-auth-google-sso', projectData.module_auth_google_sso);
    setElementValue('app-module-authorization', projectData.module_authorization);
    setElementValue('app-module-log-audit', projectData.module_log_audit);
	setRadioValue('app-data_delete_type', projectData.data_delete_type || 'hard');
	
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
	populateCustomViewsTab(tableName);
		
    const tableData = jsonData.database.table[tableName];
    if (!tableData) {
        console.error(`Tiada data ditemui untuk jadual: ${tableName}`);
        return;
    }
	
    setElementValue('tbl-table-name', tableData.table_name);
    // Tab: Table view -> General
    setElementValue('tbl-table-view-title', tableData.table_view_title);
    setElementValue('tbl-table-description', tableData.table_description);

    // Tab: Table view -> Features
    setElementValue('tbl-show-quick-search', tableData.show_quick_search);
    setElementValue('tbl-records-per-page', tableData.records_per_page);
    setElementValue('tbl-default-sort-by', tableData.default_sort_by);
    setElementValue('tbl-sort-descending', tableData.sort_descending);
    setElementValue('tbl-allow-sorting', tableData.allow_sorting);
    setElementValue('tbl-allow-filters', tableData.allow_filters);
    setElementValue('tbl-allow-csv-export', tableData.allow_csv_export);
    setElementValue('tbl-allow-print-view', tableData.allow_print_view);
    setElementValue('tbl-allow-user-save-filters', tableData.allow_user_save_filters);
    setElementValue('tbl-allow-mass-delete', tableData.allow_mass_delete);

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

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js
export function populateMenuManagement(unifiedMenu) {
    const unifiedMenuList = document.getElementById('unified-menu-list');
    if (!unifiedMenu || unifiedMenu.length === 0) {
        unifiedMenuList.innerHTML = `<div class="empty-state-label"><p>No menus or groups created.</p><span>Click a button above to start.</span></div>`;
        return;
    }

    // ▼▼▼ MULA PERUBAHAN ▼▼▼
    // Tambah zon drop di bahagian paling atas untuk membenarkan item digugurkan di kedudukan pertama
    // Fungsi bantuan untuk mencipta elemen kumpulan
    const createGroupElement = (group) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'menu-group-item';
        groupEl.dataset.type = 'group';
        groupEl.dataset.groupId = group.id;

const itemsHtml = group.items.map(item => {
    const itemType = item.table_id ? 'table_item' : 'custom_item';
    const icon = itemType === 'table_item' ? 'fa-table' : (itemType === 'custom_view_item' ? 'fa-eye' : 'fa-link');
    
    // PENAMBAHBAIKAN: Tambah data-table-name untuk menyimpan rujukan sebenar
    const tableNameAttribute = itemType === 'table_item' ? `data-table-name="${item.table_name}"` : '';

    return `
    <div class="nested-menu-item" 
         data-item-id="${item.item_id}" 
         data-label="${item.item_label || ''}" 
         data-url="${item.item_url || ''}"
         data-type="${itemType}"
         ${tableNameAttribute}>
        <i class="fas ${icon} nested-item-icon"></i>
        <span class="nested-item-label" title="${item.item_label}">${item.item_label}</span>
        <span class="nested-item-url" title="URL: ${item.item_url || 'N/A'}">${item.item_url || '(Not a link)'}</span>
        <div class="nested-item-actions">
            <button class="btn-sidebar-icon nested-menu-move-up-btn" title="Move Up"><i class="fas fa-arrow-up"></i></button>
            <button class="btn-sidebar-icon nested-menu-move-down-btn" title="Move Down"><i class="fas fa-arrow-down"></i></button>
            <button class="btn-sidebar-icon nested-menu-edit-btn" title="Edit Item"><i class="fas fa-pencil-alt"></i></button>
            <button class="btn-sidebar-icon nested-menu-delete-btn" title="Delete Item"><i class="fas fa-trash-alt"></i></button>
        </div>
    </div>
`}).join('');


        groupEl.innerHTML = `
    <div class="menu-group-header">
        <input type="text" class="group-name-input" value="${group.name}">
        <div class="group-actions">
                    <button class="btn-sidebar-icon menu-move-up-btn" title="Move Up"><i class="fas fa-arrow-up"></i></button>
                    <button class="btn-sidebar-icon menu-move-down-btn" title="Move Down"><i class="fas fa-arrow-down"></i></button>
                    <button class="btn-sidebar-icon group-delete-btn" title="Delete group"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            <div class="menu-selector">${itemsHtml}</div>`;
        return groupEl;
    };

// PASTE THIS REPLACEMENT CODE IN: uiHandlers.js

// Fungsi bantuan untuk mencipta elemen item individu
const createItemElement = (item) => {
    const itemEl = document.createElement('div');
    // Guna semula gaya sedia ada
    itemEl.className = 'custom-menu-item'; 
    itemEl.dataset.type = item.type;
    itemEl.dataset.itemId = item.id;
    itemEl.dataset.label = item.label;
    itemEl.dataset.url = item.url || '';

    // ▼▼▼ PEMBETULAN UTAMA ADA DI SINI ▼▼▼
    // Pastikan nama jadual sebenar disimpan untuk item peringkat atasan juga
    if (item.type === 'table_item') {
        itemEl.dataset.tableName = item.table_name;
    }
    // ▲▲▲ TAMAT PEMBETULAN ▲▲▲

    const icon = item.type === 'table_item' ? 'fa-table' : (item.type === 'custom_view_item' ? 'fa-eye' : 'fa-link');
    
    itemEl.innerHTML = `
    <i class="fas ${icon}" style="margin: 0 0.5rem; color: var(--secondary-color);"></i>
    <div class="form-group" style="flex: 1;">
            <input type="text" readonly value="${item.label}" title="Label: ${item.label}">
        </div>
        <div class="form-group" style="flex: 2;">
            <input type="text" readonly value="${item.url || '(Not a link)'}" title="URL: ${item.url || 'N/A'}">
        </div>
        <div class="group-actions">
            <button class="btn-sidebar-icon menu-move-up-btn" title="Move Up"><i class="fas fa-arrow-up"></i></button>
            <button class="btn-sidebar-icon menu-move-down-btn" title="Move Down"><i class="fas fa-arrow-down"></i></button>
            <button class="btn-sidebar-icon custom-menu-edit-btn" title="Edit Item"><i class="fas fa-pencil-alt"></i></button>
            <button class="btn-sidebar-icon custom-menu-delete-btn" title="Delete Item"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;
    return itemEl;
};

    // Kosongkan senarai sedia ada
    unifiedMenuList.innerHTML = ''; 

    // Bina senarai bersepadu
    unifiedMenu.forEach(item => {
        let element;
        if (item.type === 'group') {
            const groupEl = createGroupElement(item);
            unifiedMenuList.appendChild(groupEl);
            updateNestedMoveButtonStates(groupEl.querySelector('.menu-selector'));
        } else {
            unifiedMenuList.appendChild(createItemElement(item));
        }
    });

    // Kemas kini keadaan butang naik/turun selepas semua item dipaparkan
    const menuItems = unifiedMenuList.children;
    if (menuItems.length > 0) {
        menuItems[0].querySelector('.menu-move-up-btn').disabled = true;
        menuItems[menuItems.length - 1].querySelector('.menu-move-down-btn').disabled = true;
    }

    // ▲▲▲ TAMAT PERUBAHAN ▲▲▲
}

export function initializeMenuManagementHandlers() {
    const menuManagementTab = document.getElementById('tab-menu-appearance');
    if (!menuManagementTab) return;

    // Rujukan kepada elemen UI
    const addGroupBtn = document.getElementById('app-add_menu_group');
    const addCustomMenuBtn = document.getElementById('app-add_custom_menu');
    const unifiedMenuList = document.getElementById('unified-menu-list');


// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

function openCustomMenuModal(itemEl = null) {
    const modal = document.getElementById('custom-menu-modal');
    if (!modal) return;

    const modalBody = modal.querySelector('.modal-body');
    modalBody.innerHTML = `
        <div id="menu-type-selector" class="form-group">
            <label>Menu Type</label>
            <div class="radio-group-horizontal" style="margin-top: 0.5rem;">
                <label class="checkbox-label"><input type="radio" name="menu-item-type" value="custom" checked> Custom Menu</label>
                <label class="checkbox-label"><input type="radio" name="menu-item-type" value="table"> Table Menu</label>
                <label class="checkbox-label"><input type="radio" name="menu-item-type" value="custom_view"> Custom View Menu</label>
            </div>
        </div>
        <div id="custom-menu-fields-container">
            <div class="form-group"><label for="custom-menu-label-input">Menu Label</label><input type="text" id="custom-menu-label-input" placeholder="e.g., Customer Support"></div>
            <div class="form-group"><label for="custom-menu-url-input">URL</label><input type="text" id="custom-menu-url-input" placeholder="e.g., support.php"></div>
        </div>
        <div id="table-menu-fields-container" class="hidden">
            <div class="form-group"><label for="table-menu-label-input">Menu Label</label><input type="text" id="table-menu-label-input" placeholder="Enter menu label"></div>
            <div class="form-group"><label>Available Tables</label><ul id="modal-available-tables-list" class="item-list" style="max-height: 150px; overflow-y: auto; margin-top: 0.5rem;"></ul></div>
        </div>
        <div id="custom-view-menu-fields-container" class="hidden">
            <div class="form-group"><label for="cv-menu-label-input">Menu Label</label><input type="text" id="cv-menu-label-input" placeholder="Enter menu label"></div>
            <div class="form-group"><label>Available Custom Views</label><ul id="modal-available-cv-list" class="item-list" style="max-height: 150px; overflow-y: auto; margin-top: 0.5rem;"></ul></div>
        </div>
        <div class="form-group shared-menu-options"><label class="checkbox-label"><input type="checkbox" id="menu-show-record-count"> Show record count in homepage</label></div>
        <div class="form-group"><label for="custom-menu-group-select">Parent Group</label><select id="custom-menu-group-select"></select></div>
        <input type="hidden" id="custom-menu-item-id">
    `;

    const elements = {
        title: modal.querySelector('#custom-menu-modal-title'), okBtn: modal.querySelector('#custom-menu-modal-ok'),
        cancelBtn: modal.querySelector('#custom-menu-modal-cancel'), closeBtn: modal.querySelector('#custom-menu-modal-close'),
        itemIdInput: modal.querySelector('#custom-menu-item-id'), groupSelect: modal.querySelector('#custom-menu-group-select'),
        recordCountCheckbox: modal.querySelector('#menu-show-record-count'), sharedOptions: modal.querySelector('.shared-menu-options'),
        radios: modal.querySelectorAll('input[name="menu-item-type"]'),
        customFieldsContainer: modal.querySelector('#custom-menu-fields-container'), labelInput: modal.querySelector('#custom-menu-label-input'),
        urlInput: modal.querySelector('#custom-menu-url-input'), tableFieldsContainer: modal.querySelector('#table-menu-fields-container'),
        tableLabelInput: modal.querySelector('#table-menu-label-input'), tableListUl: modal.querySelector('#modal-available-tables-list'),
        cvFieldsContainer: modal.querySelector('#custom-view-menu-fields-container'), cvLabelInput: modal.querySelector('#cv-menu-label-input'),
        cvListUl: modal.querySelector('#modal-available-cv-list'),
    };

    const newOkBtn = elements.okBtn.cloneNode(true);
    elements.okBtn.parentNode.replaceChild(newOkBtn, elements.okBtn);
    const closeModal = () => modal.classList.add('hidden');
    elements.cancelBtn.addEventListener('click', closeModal, { once: true });
    elements.closeBtn.addEventListener('click', closeModal, { once: true });

    elements.radios.forEach(radio => {
        radio.addEventListener('change', () => {
            const selectedType = radio.value;
            elements.customFieldsContainer.classList.toggle('hidden', selectedType !== 'custom');
            elements.tableFieldsContainer.classList.toggle('hidden', selectedType !== 'table');
            elements.cvFieldsContainer.classList.toggle('hidden', selectedType !== 'custom_view');
            elements.sharedOptions.classList.toggle('hidden', selectedType === 'custom');
        });
    });

    const getUsedIds = () => {
        const ids = { tableIds: new Set(), cvIds: new Set() };
        jsonData.database.unified_menu.forEach(item => {
            const items = item.type === 'group' ? item.items : [item];
            items.forEach(i => {
                if (i.table_id) ids.tableIds.add(i.table_id);
                if (i.custom_view_id) ids.cvIds.add(i.custom_view_id);
            });
        });
        return ids;
    };
    const { tableIds: usedTableIds, cvIds: usedCvIds } = getUsedIds();

    const availableTables = Object.values(jsonData.database.table).filter(t => !usedTableIds.has(t.table_id));
    elements.tableListUl.innerHTML = availableTables.length > 0 ? availableTables.filter(t => t && t.table_name).map(t => `<li data-table-name="${t.table_name}">${t.table_name}</li>`).join('') : '<li>No unassigned tables available.</li>';

    const availableCustomViews = [];
    Object.values(jsonData.database.table).forEach(table => {
        (table.custom_views || []).forEach(view => {
            if (!usedCvIds.has(view.custom_view_id)) {
                availableCustomViews.push({ ...view, table_name: table.table_name });
            }
        });
    });
    elements.cvListUl.innerHTML = availableCustomViews.length > 0 ? availableCustomViews.map(v => `<li data-cv-id="${v.custom_view_id}">${v.table_name} - ${v.view_name}</li>`).join('') : '<li>No unassigned Custom Views available.</li>';
    
    const allCustomViews = [];
    Object.values(jsonData.database.table).forEach(table => {
        (table.custom_views || []).forEach(view => {
            allCustomViews.push({ ...view, table_name: table.table_name });
        });
    });

    elements.groupSelect.innerHTML = '<option value="">None (Top Level)</option>';
    jsonData.database.unified_menu.filter(item => item.type === 'group').forEach(group => { elements.groupSelect.innerHTML += `<option value="${group.id}">${group.name}</option>`; });

    if (itemEl) {
        elements.title.textContent = 'Edit Menu Item';
        elements.itemIdInput.value = itemEl.dataset.itemId;
        elements.radios.forEach(radio => radio.disabled = true);
        const itemType = itemEl.dataset.type;
        const allItems = [...jsonData.database.unified_menu.flatMap(i => i.type === 'group' ? i.items : i)];
        
        // ▼▼▼ KOD CARIAN YANG TELAH DIPERBAIKI SEPENUHNYA ▼▼▼
        const itemIdToFind = parseInt(itemEl.dataset.itemId, 10);
        const itemData = allItems.find(i => (i.item_id || i.id) === itemIdToFind);
        // ▲▲▲ TAMAT PEMBAIKAN ▲▲▲

        const radioValueMap = { 'custom_item': 'custom', 'table_item': 'table', 'custom_view_item': 'custom_view' };
        const radioToSelect = document.querySelector(`input[name="menu-item-type"][value="${radioValueMap[itemType]}"]`);
        if (radioToSelect) { radioToSelect.checked = true; radioToSelect.dispatchEvent(new Event('change')); }
        if (itemType === 'table_item') {
            elements.tableLabelInput.value = itemEl.dataset.label;
            elements.tableListUl.innerHTML = `<li class="active">${itemEl.dataset.tableName}</li>`;
            elements.tableListUl.style.pointerEvents = 'none';
        } else if (itemType === 'custom_view_item') {
            elements.cvLabelInput.value = itemEl.dataset.label;

            // ▼▼▼ BLOK DEBUGGING DITAMBAH DI SINI ▼▼▼
            console.log("--- DEBUGGING CUSTOM VIEW EDIT ---");
            console.log("1. Data Item Menu (dari jsonData):", itemData);
            console.log("2. ID yang dicari:", itemData?.custom_view_id, "(Jenis:", typeof itemData?.custom_view_id, ")");
            console.log("3. Mencari di dalam senarai ini (allCustomViews):", allCustomViews);
            
            const cvData = allCustomViews.find(v => {
                console.log(`- Membandingkan: Menu Item CV ID ${itemData?.custom_view_id} (jenis: ${typeof itemData?.custom_view_id}) dengan View ID ${v.custom_view_id} (jenis: ${typeof v.custom_view_id})`);
                return v.custom_view_id == itemData?.custom_view_id;
            }) || { table_name: 'Unknown', view_name: 'View' };
            
            console.log("4. Hasil carian (cvData):", cvData);
            console.log("--- TAMAT DEBUGGING ---");
            // ▲▲▲ TAMAT BLOK DEBUGGING ▲▲▲
            
            elements.cvListUl.innerHTML = `<li class="active" data-cv-id="${cvData.custom_view_id}">${cvData.table_name} - ${cvData.view_name}</li>`;
            elements.cvListUl.style.pointerEvents = 'none';
        } else {
            elements.labelInput.value = itemEl.dataset.label;
            elements.urlInput.value = itemEl.dataset.url || '';
        }
        if (itemData) { elements.recordCountCheckbox.checked = itemData.show_record_count === 1; }
        const parentGroup = itemEl.closest('.menu-group-item');
        elements.groupSelect.value = parentGroup ? parentGroup.dataset.groupId : '';
    } else {
        elements.title.textContent = 'Add New Menu Item';
    }

    let selectedTableName = null, selectedCvId = null;
    elements.tableListUl.addEventListener('click', e => {
        if (e.target.tagName === 'LI' && e.target.dataset.tableName) {
            elements.tableListUl.querySelectorAll('li').forEach(li => li.classList.remove('active'));
            e.target.classList.add('active');
            selectedTableName = e.target.dataset.tableName;
            elements.tableLabelInput.value = selectedTableName;
        }
    });
    elements.cvListUl.addEventListener('click', e => {
        if (e.target.tagName === 'LI' && e.target.dataset.cvId) {
            elements.cvListUl.querySelectorAll('li').forEach(li => li.classList.remove('active'));
            e.target.classList.add('active');
            selectedCvId = e.target.dataset.cvId;
            elements.cvLabelInput.value = e.target.textContent;
        }
    });

// FIND AND REPLACE THIS ENTIRE 'newOkBtn.addEventListener' BLOCK IN: uiHandlers.js
// It is located inside the openCustomMenuModal function

    newOkBtn.addEventListener('click', async () => {
        const selectedType = modal.querySelector('input[name="menu-item-type"]:checked').value;
        const itemId = elements.itemIdInput.value || null;
        let dataToSave = { project_id: activeProject.project_id, item_id: itemId, menu_group_id: elements.groupSelect.value || null };

        if (selectedType === 'table') {
            const tableLabel = elements.tableLabelInput.value.trim();
            if (!tableLabel) { showCustomDialog({ title: "Input Required", message: "Menu Label is required." }); return; }
            
            let tableNameForSave;
            if (itemId) { // Mod Edit
                tableNameForSave = itemEl.dataset.tableName;
            } else { // Mod Tambah Baru
                const activeLi = elements.tableListUl.querySelector('li.active');
                tableNameForSave = activeLi ? activeLi.dataset.tableName : null;
            }

            if (!tableNameForSave) { showCustomDialog({ title: "Input Required", message: "Please select a table." }); return; }
            const tableData = jsonData.database.table[tableNameForSave];
            if (!tableData) { showCustomDialog({ title: "Error", message: "Table data not found." }); return; }
            dataToSave = { ...dataToSave, label: tableLabel, url: `${tableNameForSave} Resource`, table_id: tableData.table_id, custom_view_id: null, show_record_count: elements.recordCountCheckbox.checked };
        
        } else if (selectedType === 'custom_view') {
            const cvLabel = elements.cvLabelInput.value.trim();
            if (!cvLabel) { showCustomDialog({ title: "Input Required", message: "Menu Label is required." }); return; }

            // ▼▼▼ BLOK PEMBAIKAN UTAMA ▼▼▼
            // Dapatkan ID terus dari elemen senarai yang aktif.
            // Logik ini berfungsi untuk kedua-dua mod Tambah Baru (selepas diklik) dan mod Edit (sudah sedia aktif).
            const activeLi = elements.cvListUl.querySelector('li.active');
            const cvIdForSave = activeLi ? activeLi.dataset.cvId : null;

            if (!cvIdForSave) {
                showCustomDialog({ title: "Input Required", message: "Please select a Custom View." });
                return;
            }
            // ▲▲▲ TAMAT BLOK PEMBAIKAN ▲▲▲

            const cvData = allCustomViews.find(v => v.custom_view_id == cvIdForSave);
            if (!cvData) { showCustomDialog({ title: "Error", message: "Custom View data not found." }); return; }
            dataToSave = { ...dataToSave, label: cvLabel, url: `${cvData.table_name} - ${cvData.view_name}`, table_id: null, custom_view_id: cvIdForSave, show_record_count: elements.recordCountCheckbox.checked };
            
        } else { // custom
            const customLabel = elements.labelInput.value.trim();
            if (!customLabel) { showCustomDialog({ title: "Input Required", message: "Menu Label is required." }); return; }
            dataToSave = { ...dataToSave, label: customLabel, url: elements.urlInput.value.trim(), table_id: null, custom_view_id: null, show_record_count: false };
        }

        const result = await window.electronAPI.saveCustomMenuItem(dataToSave);
        if (result.success) { closeModal(); await loadProjectData(activeProject); }
        else { showCustomDialog({ title: "Error", message: `Failed to save menu item: ${result.message}` }); }
    }, { once: true });
    modal.classList.remove('hidden');
}

    const saveUnifiedStructure = async () => {
        if (!unifiedMenuList) return;
        
        const structure = Array.from(unifiedMenuList.childNodes).map(node => {
            if (node.matches('.menu-group-item')) {
                return {
                    type: 'group',
                    id: node.dataset.groupId,
                    name: node.querySelector('.group-name-input').value,
                    items: Array.from(node.querySelectorAll('.nested-menu-item')).map(item => ({
                        id: item.dataset.itemId
                    }))
                };
            } else if (node.matches('.custom-menu-item')) {
                return {
                    type: node.dataset.type,
                    id: node.dataset.itemId
                };
            }
            return null;
        }).filter(Boolean);
        
        const result = await window.electronAPI.saveUnifiedMenu({ projectId: activeProject.project_id, menuStructure: structure });
        if (!result.success) {
            showCustomDialog({ title: "Save Error", message: "Failed to save menu structure: " + result.message });
        }
    };
    // Pengendali Acara untuk Butang
    addCustomMenuBtn.addEventListener('click', () => openCustomMenuModal());
    addGroupBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.menuCreateGroup({ projectId: activeProject.project_id, groupName: "New Group" });
        if (result.success) {
            await loadProjectData(activeProject);
        } else {
            showCustomDialog({ title: "Error", message: "Failed to create new group: " + result.message });
        }
    });

    let currentTargetMenuSelector = null;
    menuManagementTab.addEventListener('click', (e) => {
        const target = e.target;
        // ▼▼▼ MULA PERUBAHAN: Tambah rujukan kepada item bersarang (nested) ▼▼▼
        const customItem = target.closest('.custom-menu-item');
        const groupItem = target.closest('.menu-group-item');
        const nestedItem = target.closest('.nested-menu-item');
        // ▲▲▲ TAMAT PERUBAHAN ▲▲▲

        // ▼▼▼ MULA PERUBAHAN: Tambah logik untuk butang pada item bersarang ▼▼▼
        if (target.closest('.nested-menu-delete-btn') && nestedItem) {
            showCustomDialog({
                title: "Confirm Deletion",
                message: "Are you sure you want to delete this menu item?",
                showCancelButton: true,
                onOk: async () => {
                    await window.electronAPI.saveCustomMenuItem({ item_id: nestedItem.dataset.itemId, project_id: activeProject.project_id, label: 'DELETE', url: 'DELETE' });
                    await loadProjectData(activeProject);
                }
            });
        }
        // ▲▲▲ TAMAT PERUBAHAN ▲▲▲
        if (target.closest('.group-delete-btn') && groupItem) {
            showCustomDialog({
                title: "Confirm Group Deletion",
                message: `Are you sure you want to permanently delete the group "${groupItem.querySelector('.group-name-input').value}" and all items within it?`,
                showCancelButton: true,
                onOk: async () => {
                    await window.electronAPI.menuDeleteGroup({ groupId: groupItem.dataset.groupId });
                    await loadProjectData(activeProject);
                }
            });
        } 
        else if (target.closest('.custom-menu-delete-btn') && customItem) {
             showCustomDialog({
                title: "Confirm Deletion",
                message: "Are you sure you want to delete this menu item?",
                showCancelButton: true,
                onOk: async () => {
                    await window.electronAPI.saveCustomMenuItem({ item_id: customItem.dataset.itemId, project_id: activeProject.project_id, label: 'DELETE', url: 'DELETE' });
                    await loadProjectData(activeProject);
                }
            });
        } 
        // ▼▼▼ MULA PERUBAHAN: Tambah logik untuk butang pada item bersarang ▼▼▼
        else if (target.closest('.nested-menu-edit-btn') && nestedItem) {
            openCustomMenuModal(nestedItem);
        }
        // ▲▲▲ TAMAT PERUBAHAN ▲▲▲
        else if (target.closest('.custom-menu-edit-btn') && customItem) {
            openCustomMenuModal(customItem);
        }
    });

    // Simpan Nama Kumpulan serta-merta
    let debounceTimer;
    menuManagementTab.addEventListener('input', (e) => {
        if (e.target.matches('.group-name-input')) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(saveUnifiedStructure, 750);
        }
    });

    // ▼▼▼ SISTEM BAHARU: PENGURUSAN SUSUNAN GUNA BUTANG NAIK/TURUN ▼▼▼
    const updateMoveButtonStates = () => {
        const items = unifiedMenuList.querySelectorAll('.menu-group-item, .custom-menu-item');
        items.forEach((item, index) => {
            const upBtn = item.querySelector('.menu-move-up-btn');
            const downBtn = item.querySelector('.menu-move-down-btn');
            if (upBtn) upBtn.disabled = (index === 0);
            if (downBtn) downBtn.disabled = (index === items.length - 1);
        });
    };

    unifiedMenuList.addEventListener('click', async (e) => {
        // ▼▼▼ MULA LOGIK BAHARU: Butang naik/turun untuk item di dalam kumpulan ▼▼▼
        const nestedUpBtn = e.target.closest('.nested-menu-move-up-btn');
        const nestedDownBtn = e.target.closest('.nested-menu-move-down-btn');

        if (nestedUpBtn || nestedDownBtn) {
            const currentItem = e.target.closest('.nested-menu-item');
            const container = currentItem.parentElement; // Ini adalah .menu-selector
            if (!currentItem || !container) return;

            if (nestedUpBtn) {
                const prevItem = currentItem.previousElementSibling;
                if (prevItem) container.insertBefore(currentItem, prevItem);
            } else if (nestedDownBtn) {
                const nextItem = currentItem.nextElementSibling;
                if (nextItem) container.insertBefore(currentItem, nextItem.nextElementSibling);
            }

            updateNestedMoveButtonStates(container);
            await saveUnifiedStructure();
            return; // Hentikan proses selanjutnya untuk klik ini
        }
        // ▲▲▲ TAMAT LOGIK BAHARU ▲▲▲

        const upBtn = e.target.closest('.menu-move-up-btn');
        const downBtn = e.target.closest('.menu-move-down-btn');

        if (!upBtn && !downBtn) return;

        const currentItem = e.target.closest('.menu-group-item, .custom-menu-item');
        if (!currentItem) return;

        if (upBtn) {
            const prevItem = currentItem.previousElementSibling;
            if (prevItem) {
                unifiedMenuList.insertBefore(currentItem, prevItem);
            }
        } else if (downBtn) {
            const nextItem = currentItem.nextElementSibling;
            if (nextItem) {
                unifiedMenuList.insertBefore(currentItem, nextItem.nextElementSibling);
            }
        }

        // Kemas kini keadaan butang selepas pergerakan
        updateMoveButtonStates();

        // Simpan struktur baharu
        await saveUnifiedStructure();
    });
    // ▲▲▲ TAMAT SISTEM BAHARU ▲▲▲
}
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
        { value: '=', text: 'matched' },
        { value: '!=', text: 'unmatched' },
        { value: '>', text: 'above' },
        { value: '<', text: 'below' },
        { value: '>=', text: 'at least' },
        { value: '<=', text: 'at most' },
        { value: 'LIKE', text: 'contains' },
        { value: 'NOT LIKE', text: 'without' },
        { value: 'IN', text: 'among(a,b,c)' },
        { value: 'NOT IN', text: 'outside(a,b,c)' },
        { value: 'IS NULL', text: 'is empty' },
        { value: 'IS NOT NULL', text: 'has content' }
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

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

function addRuleOrGroup(button, type) {
    // ▼▼▼ MULA PEMBETULAN: Selector 'closest' dan 'querySelector' telah diperluas ▼▼▼
    const parentContainer = button.closest('.cqb-rule-group, #cqb-container, #cv-filter-builder-container');
    if (!parentContainer) return; // Safety check

    // Cari bekas yang betul untuk menambah peraturan (rule) atau kumpulan (group)
    const targetContainer = parentContainer.querySelector('.qb-nested-rules, #cqb-rules-container, div');
    // ▲▲▲ TAMAT PEMBETULAN ▲▲▲

    const tableName = button.closest('#configurable-query-builder-modal, #custom-view-config-modal').dataset.tableName;
    
    if (targetContainer) {
        if(type === 'rule') {
            const newRule = createRuleElement(tableName);
            targetContainer.appendChild(newRule);
            
            // Jika ini adalah peraturan pertama, buang butang "Add Rule" asal
            const initialAddButton = parentContainer.querySelector('.cqb-add-nested-rule');
            if (initialAddButton && initialAddButton.parentElement !== targetContainer) {
                initialAddButton.parentElement.remove();
            }
        }
        else {
             targetContainer.appendChild(createRuleGroupElement());
        }
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

/**
 * Membuka Query Snippet Helper yang berkuasa dan kontekstual.
 * @param {object} options - Objek konfigurasi.
 * @param {HTMLTextAreaElement} options.targetTextarea - Textarea sasaran untuk menerima output.
 * @param {object} options.context - Maklumat tentang di mana helper dibuka.
 */
export function openQueryHelperModal(options) {
    const modal = document.getElementById('query-helper-modal');
    const modalBody = document.getElementById('qh-modal-body');
    const template = document.getElementById('query-helper-template');

    if (!modal || !modalBody || !template) return;

    // 1. Sediakan UI
    modalBody.innerHTML = '';
    modalBody.appendChild(template.content.cloneNode(true));
    modal.classList.remove('hidden');

    // 2. Rujukan kepada elemen UI
    const elements = {
        tableSelect: document.getElementById('qh-table-select'),
        fieldList: document.getElementById('qh-field-list'),
        relationList: document.getElementById('qh-relation-list'),
        previewArea: document.getElementById('qh-preview-area'),
        templateTabs: document.querySelectorAll('.qh-tabs-nav .tab-link'),
        insertBtn: document.getElementById('qh-insert-snippet'),
        closeBtn: document.getElementById('qh-modal-close'),
        cancelBtn: document.getElementById('qh-modal-cancel'),
    };

    // 3. State Management
    let state = {
        mainTable: options.context.tableName || null,
        selectedFields: new Set(),
        activeTemplate: 'select',
        activeJoins: new Set(), // Menggunakan Set untuk menguruskan JOIN yang aktif
    };

    // 4. Fungsi-Fungsi Teras

    /**
     * FUNGSI BAHARU: Mengemas kini senarai medan yang boleh dipilih.
     * Ia akan memasukkan medan dari jadual utama dan mana-mana jadual yang di-JOIN.
     */
    const updateAvailableFields = () => {
        elements.fieldList.innerHTML = '';
        const tablesToInclude = new Set([state.mainTable, ...Array.from(state.activeJoins).map(join => join.relatedTable)]);
        
        tablesToInclude.forEach(tableName => {
            if (!tableName) return;
            const tableData = jsonData.database.table[tableName];
            if (tableData && tableData.fields) {
                Object.keys(tableData.fields).forEach(fieldName => {
                    // Gunakan nama penuh (jadual.medan) sebagai pengenal pasti unik
                    const qualifiedName = `${tableName}.${fieldName}`;
                    const li = document.createElement('li');
                    li.className = 'qh-list-item';
                    li.dataset.field = qualifiedName;
                    // Paparkan nama penuh jika bukan jadual utama untuk mengelakkan kekeliruan
                    li.innerHTML = `<input type="checkbox" ${state.selectedFields.has(qualifiedName) ? 'checked' : ''}><span>${tableName === state.mainTable ? fieldName : qualifiedName}</span>`;
                    if (state.selectedFields.has(qualifiedName)) {
                        li.classList.add('selected');
                    }
                    elements.fieldList.appendChild(li);
                });
            }
        });
    };

    const updatePreview = () => {
        if (!state.mainTable) {
            elements.previewArea.value = 'Select a table context to begin...';
            return;
        }

        // Penjanaan query yang lebih bijak, menyokong nama medan yang penuh
        const fields = state.selectedFields.size > 0 ?
            Array.from(state.selectedFields).map(f => {
                const [tableName, fieldName] = f.split('.');
                return `\`${tableName}\`.\`${fieldName}\``;
            }).join(',\n    ') : `\`${state.mainTable}\`.*`;

        const joinClause = Array.from(state.activeJoins).map(join => join.clause).join('\n');

        let query = '';
        switch (state.activeTemplate) {
            case 'select':
                query = `SELECT\n    ${fields}\nFROM\n    \`${state.mainTable}\`\n${joinClause}`;
                break;
            // ... (logik untuk templat lain kekal sama) ...
        }
        elements.previewArea.value = query.trim() + ';';
    };

    const populateInitialUI = (tableName) => {
        state.mainTable = tableName;
        state.selectedFields.clear();
        state.activeJoins.clear();
        
        elements.relationList.innerHTML = '';

        if (!tableName) {
            updateAvailableFields();
            updatePreview();
            return;
        }

        // Isi senarai relationship
        jsonData.database.relationships.forEach(rel => {
            let relatedTable, relText;
            if (rel.parent_table_name === tableName) {
                relatedTable = rel.child_table_name;
                relText = `Has many: ${relatedTable}`;
            } else if (rel.child_table_name === tableName) {
                relatedTable = rel.parent_table_name;
                relText = `Belongs to: ${relatedTable}`;
            } else {
                return;
            }
            
            const li = document.createElement('li');
            li.className = 'qh-list-item';
            li.dataset.rel = JSON.stringify(rel);
            li.dataset.relatedTable = relatedTable; // Simpan nama jadual berkaitan
            li.innerHTML = `<i class="fas fa-link"></i><span>${relText}</span>`;
            elements.relationList.appendChild(li);
        });

        updateAvailableFields();
        updatePreview();
    };

    // 5. Pasang Event Listeners
    elements.tableSelect.addEventListener('change', () => populateInitialUI(elements.tableSelect.value));

    elements.fieldList.addEventListener('click', (e) => {
        const li = e.target.closest('.qh-list-item');
        if (!li) return;
        const fieldName = li.dataset.field;
        const checkbox = li.querySelector('input');
        if (state.selectedFields.has(fieldName)) {
            state.selectedFields.delete(fieldName);
            li.classList.remove('selected');
            checkbox.checked = false;
        } else {
            state.selectedFields.add(fieldName);
            li.classList.add('selected');
            checkbox.checked = true;
        }
        updatePreview();
    });
    
    // Logik utama yang ditambah baik
    elements.relationList.addEventListener('click', (e) => {
        const li = e.target.closest('.qh-list-item');
        if (!li) return;
        
        const rel = JSON.parse(li.dataset.rel);
        const relatedTable = li.dataset.relatedTable;
        const joinClause = `LEFT JOIN \`${rel.parent_table_name}\` ON \`${rel.child_table_name}\`.\`${rel.fk_child_field}\` = \`${rel.parent_table_name}\`.\`${rel.parent_field}\``;
        const joinObject = { relatedTable, clause: joinClause };

        const wasActive = li.classList.contains('selected');

        if (wasActive) {
            // Buang JOIN dari state
            state.activeJoins.forEach(j => {
                if (j.clause === joinClause) state.activeJoins.delete(j);
            });
            li.classList.remove('selected');

            // Buang medan yang telah dipilih dari jadual yang dibuang
            state.selectedFields.forEach(field => {
                if (field.startsWith(`${relatedTable}.`)) {
                    state.selectedFields.delete(field);
                }
            });

        } else {
            // Tambah JOIN ke state
            state.activeJoins.add(joinObject);
            li.classList.add('selected');
        }

        updateAvailableFields(); // Bina semula senarai medan yang boleh dipilih
        updatePreview(); // Kemas kini pratonton query
    });

    elements.templateTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.templateTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.activeTemplate = tab.dataset.template;
            updatePreview();
        });
    });

    // ... (listener untuk butang-butang lain kekal sama) ...
    const closeModal = () => modal.classList.add('hidden');
    elements.insertBtn.addEventListener('click', () => {
        const snippet = elements.previewArea.value;
        options.targetTextarea.value += snippet;
        options.targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        closeModal();
    });
    elements.closeBtn.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);

    // 6. Logik Kontekstual Permulaan
    const allTables = Object.keys(jsonData.database.table);
    elements.tableSelect.innerHTML = '<option value="">-- Select a table --</option>' + allTables.map(t => `<option value="${t}">${t}</option>`).join('');
    
    if (options.context.tableName) {
        elements.tableSelect.value = options.context.tableName;
        if (options.context.page === 'field' || options.context.page === 'table') {
            elements.tableSelect.disabled = true;
        }
    }
    
    populateInitialUI(state.mainTable);
}

/**
 * Adds logic to radio buttons to allow them to be deselected.
 * A standard radio button group doesn't allow having no option selected once a selection is made.
 */
export function initializeAuthRadioLogic() {
    const radios = document.querySelectorAll('input[name="app-module-auth-extra"]');
    if (!radios) return;

    radios.forEach(radio => {
        // We need to store the state on "mousedown" because by the time "click" fires,
        // the state will have already changed.
        radio.addEventListener('mousedown', function() {
            // Store the current checked state in a temporary property.
            this.wasChecked = this.checked;
        });

        radio.addEventListener('click', function() {
            // If the radio was already checked when the user pressed the mouse,
            // uncheck it now.
            if (this.wasChecked) {
                this.checked = false;
                // Manually trigger the 'change' event so our auto-save system picks it up.
                this.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });
}

/**
 * Memaparkan modal panduan penyelesaian ralat untuk Import SQL.
 */
export function showImportErrorGuide() {
    const modal = document.getElementById('sql-import-error-modal');
    if (!modal) return;

    const okBtn = document.getElementById('sql-import-error-ok-btn');
    const closeModal = () => modal.classList.add('hidden');
    
    // Guna cloneNode untuk memastikan event listener lama dibuang
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    newOkBtn.addEventListener('click', closeModal);
    
    modal.classList.remove('hidden');
}

// ADD THIS ENTIRE CODE BLOCK AT THE END OF uiHandlers.js

// ==================================================================
// == CUSTOM VIEWS FEATURE LOGIC                                 ==
// ==================================================================

/**
 * Mengisi kandungan tab "Custom Views" dengan senarai view yang telah dicipta.
 * @param {string} tableName - Nama jadual semasa.
 */
export function populateCustomViewsTab(tableName) {
    const container = document.getElementById('custom-views-list-container');
    if (!container) return;

    const views = jsonData.database.table[tableName]?.custom_views || [];

    if (views.length === 0) {
        container.innerHTML = `
            <div class="empty-state-label">
                <p>No Custom Views created yet.</p>
                <span>Click the button above to create one.</span>
            </div>`;
        return;
    }

    container.innerHTML = views.map(view => `
        <div class="cv-list-item">
            <div class="cv-info">
                <i class="fas ${view.menu_icon || 'fa-eye'}"></i>
                <span>${view.view_name}</span>
            </div>
            <div class="cv-actions">
                <button class="btn btn-secondary cv-edit-btn" data-view-id="${view.custom_view_id}">
                    <i class="fas fa-pencil-alt"></i> Edit
                </button>
                <button class="btn cv-delete-btn" data-view-id="${view.custom_view_id}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}


/**
 * Membuka dan menguruskan modal konfigurasi Custom View (untuk tambah/edit).
 * @param {string} tableName - Nama jadual semasa.
 * @param {object|null} viewData - Data untuk view sedia ada jika dalam mod edit.
 */

function openCustomViewModal(tableName, viewData = null) {
    const modal = document.getElementById('custom-view-config-modal');
    if (!modal) return;

    modal.dataset.tableName = tableName;
    
    const elements = {
        title: document.getElementById('cv-modal-title'),
        viewIdInput: document.getElementById('cv-view-id'),
        viewNameInput: document.getElementById('cv-view-name'),
        menuIconInput: document.getElementById('cv-menu-icon'),
        filterContainer: document.getElementById('cv-filter-builder-container'),
        ownerOnlyCheckbox: document.getElementById('cv-owner-only-checkbox'),
        ownerFieldContainer: document.getElementById('cv-owner-field-container'),
        ownerFieldSelect: document.getElementById('cv-owner-field-select'),
        nextBtn: document.getElementById('cv-modal-next'), // <-- TAMBAH RUJUKAN BUTANG
    };

    const isEditing = viewData !== null;
    elements.title.textContent = isEditing ? `Edit Custom View: ${viewData.view_name}` : `Create New Custom View for '${tableName}'`;
    elements.viewIdInput.value = isEditing ? viewData.custom_view_id : '';
    elements.viewNameInput.value = isEditing ? viewData.view_name : '';
    elements.menuIconInput.value = isEditing ? viewData.menu_icon : '';
    
    elements.ownerFieldSelect.innerHTML = '';
    const fields = jsonData.database.table[tableName]?.fields || {};
    Object.keys(fields).forEach(fieldName => {
        elements.ownerFieldSelect.add(new Option(fieldName, fieldName));
    });

    elements.ownerOnlyCheckbox.checked = isEditing && viewData.owner_only === 1;
    elements.ownerFieldContainer.classList.toggle('hidden', !elements.ownerOnlyCheckbox.checked);
    if (isEditing && viewData.owner_field) {
        elements.ownerFieldSelect.value = viewData.owner_field;
    }

    // Listener ini kini dikendalikan dalam initializeCustomViewModalLogic untuk mengelak pertindihan
    // elements.ownerOnlyCheckbox.addEventListener('change', ...);

    // ▼▼▼ MULA LOGIK BAHARU ▼▼▼
    // Tetapkan keadaan awal butang 'Next'.
    // Jika mod sunting (isEditing), aktifkan butang. Jika tidak, nyahaktifkan.
    elements.nextBtn.disabled = !isEditing;
    // ▲▲▲ TAMAT LOGIK BAHARU ▲▲▲

    // Reset keadaan pengesahan setiap kali modal dibuka
    document.getElementById('cv-name-validation-message').style.display = 'none';
    elements.viewNameInput.classList.remove('is-invalid');
	
    const filterState = isEditing ? JSON.parse(viewData.filter_rules || '{}') : null;
    elements.filterContainer.innerHTML = '';
    const filterBuilderWrapper = document.createElement('div');
    elements.filterContainer.appendChild(filterBuilderWrapper);
    buildRulesUI(filterBuilderWrapper, filterState, tableName);
    
    if (!filterState || !filterState.rules || !filterState.rules.length === 0) {
        const buttonContainer = document.createElement('div');
        buttonContainer.innerHTML = `<button class="btn btn-secondary btn-sm cqb-add-nested-rule"><i class="fas fa-plus"></i> Add Rule</button>`;
        filterBuilderWrapper.appendChild(buttonContainer);
        buttonContainer.querySelector('button').addEventListener('click', e => addRuleOrGroup(e.target, 'rule'));
    }

    populateAvailableFieldsTree(tableName);
    const formLayoutPanel = document.getElementById('cv-form-layout-panel');
    formLayoutPanel.innerHTML = `<div class="empty-state-label"><p>Drag fields here</p></div>`;
    if (isEditing && viewData.fields) {
        populateFormBuilder(viewData.fields);
    }
    
    document.getElementById('cv-step-1').classList.remove('hidden');
    document.getElementById('cv-step-2').classList.add('hidden');
    document.getElementById('cv-modal-back').classList.add('hidden');
    document.getElementById('cv-modal-save').classList.add('hidden');
    document.getElementById('cv-modal-next').classList.remove('hidden');

    modal.classList.remove('hidden');
}

/**
 * Fungsi utama untuk memasang semua event listener untuk ciri Custom Views.
 */
export function initializeCustomViews() {
    const tableSettingsPage = document.getElementById('table-settings-page');
    if (!tableSettingsPage) return;

    // Pasang listener untuk modal SEKALI SAHAJA
    initializeCustomViewModalLogic();

    // Event delegation untuk butang "Add", "Edit", dan "Delete" di dalam tab
    tableSettingsPage.addEventListener('click', e => {
        const currentTableName = document.querySelector('#table-settings-page .table-name').textContent;
        if (!currentTableName) return;

        if (e.target.closest('#btn-add-custom-view')) {
            openCustomViewModal(currentTableName);
        }

        const editBtn = e.target.closest('.cv-edit-btn');
        if (editBtn) {
            const viewId = parseInt(editBtn.dataset.viewId, 10);
            const viewData = jsonData.database.table[currentTableName]?.custom_views.find(v => v.custom_view_id === viewId);
            if (viewData) {
                openCustomViewModal(currentTableName, viewData);
            }
        }

        const deleteBtn = e.target.closest('.cv-delete-btn');
        if (deleteBtn) {
            const viewId = parseInt(deleteBtn.dataset.viewId, 10);
            showCustomDialog({
                title: "Confirm Deletion",
                message: "Are you sure you want to permanently delete this Custom View? This action cannot be undone.",
                showCancelButton: true,
                onOk: async () => {
                    const result = await window.electronAPI.deleteCustomView(viewId);
                    if (result.success) {
                        await loadProjectData(activeProject);
                        populateCustomViewsTab(currentTableName);
                    } else {
                        showCustomDialog({ title: "Error", message: `Failed to delete view: ${result.message}`});
                    }
                }
            });
        }
    });
}

// js/uiHandlers.js
// CARI DAN GANTI KESELURUHAN FUNGSI INI

function initializeCustomViewModalLogic() {
    const modal = document.getElementById('custom-view-config-modal');
    if (!modal) return;
    
    if (modal.dataset.listenersAttached === 'true') return;

    // Rujukan kepada elemen yang terlibat
    const viewNameInput = document.getElementById('cv-view-name');
    const nextBtn = document.getElementById('cv-modal-next');
    const ownerOnlyCheckbox = document.getElementById('cv-owner-only-checkbox');
    const ownerFieldContainer = document.getElementById('cv-owner-field-container');
    const listContainer = document.getElementById('cv-available-fields-list');
    const formLayoutPanel = document.getElementById('cv-form-layout-panel');
    const btnMoveToLayout = document.getElementById('cv-btn-move-to-layout');
    const btnRemoveFromLayout = document.getElementById('cv-btn-remove-from-layout');
    const elements = {
        step1: document.getElementById('cv-step-1'),
        step2: document.getElementById('cv-step-2'),
        btnBack: document.getElementById('cv-modal-back'),
        btnNext: nextBtn,
        btnSave: document.getElementById('cv-modal-save'),
        btnCancel: document.getElementById('cv-modal-cancel'),
        btnClose: document.getElementById('cv-modal-close'),
    };

    const showStep = (step) => {
        if (step === 2) {
            elements.step1.classList.add('hidden');
            elements.step2.classList.remove('hidden');
            elements.btnBack.classList.remove('hidden');
            elements.btnSave.classList.remove('hidden');
            elements.btnNext.classList.add('hidden');
        } else { // Balik ke langkah 1
            elements.step1.classList.remove('hidden');
            elements.step2.classList.add('hidden');
            elements.btnBack.classList.add('hidden');
            elements.btnSave.classList.add('hidden');
            elements.btnNext.classList.remove('hidden');
        }
    };

    // --- LOGIK YANG DIPERMUDAHKAN ---
    // Hanya periksa input untuk mengaktifkan/menyahaktifkan butang 'Next'
    viewNameInput.addEventListener('input', () => {
        nextBtn.disabled = viewNameInput.value.trim() === '';
    });

    // Butang 'Next' kini hanya mempunyai satu tugas: pergi ke langkah 2
    elements.btnNext.addEventListener('click', () => showStep(2));
    
    // Logik sedia ada yang lain dikekalkan
    ownerOnlyCheckbox.addEventListener('change', () => {
        ownerFieldContainer.classList.toggle('hidden', !ownerOnlyCheckbox.checked);
    });
    
    const handleMultiSelect = (e) => {
        const item = e.target.closest('.field-item, .form-field-item');
        if (item) item.classList.toggle('selected');
    };
    listContainer.addEventListener('click', handleMultiSelect);
    formLayoutPanel.addEventListener('click', handleMultiSelect);

    btnMoveToLayout.addEventListener('click', () => {
        const selectedFields = listContainer.querySelectorAll('.field-item.selected');
        selectedFields.forEach(field => {
            createFormFieldInLayout({ ...field.dataset }, formLayoutPanel);
            field.remove();
        });
        updateFormFieldMoveButtons(formLayoutPanel);
    });

    btnRemoveFromLayout.addEventListener('click', () => {
        const selectedFields = formLayoutPanel.querySelectorAll('.form-field-item.selected');
        const currentTableName = modal.dataset.tableName;
        selectedFields.forEach(field => field.remove());
        populateAvailableFieldsTree(currentTableName);
        updateFormFieldMoveButtons(formLayoutPanel);
    });
    
    formLayoutPanel.addEventListener('click', e => {
        const button = e.target.closest('button');
        const item = e.target.closest('.form-field-item');
        if (!button || !item) return;
        const currentTableName = modal.dataset.tableName;
        if (button.classList.contains('move-up-btn') && item.previousElementSibling) item.parentElement.insertBefore(item, item.previousElementSibling);
        else if (button.classList.contains('move-down-btn') && item.nextElementSibling) item.parentElement.insertBefore(item.nextElementSibling, item);
        else if (button.classList.contains('delete-form-field-btn')) {
            item.remove();
            populateAvailableFieldsTree(currentTableName);
        }
        updateFormFieldMoveButtons(formLayoutPanel);
    });

    elements.btnBack.addEventListener('click', () => showStep(1));
    const closeModal = () => modal.classList.add('hidden');
    elements.btnCancel.addEventListener('click', closeModal);
    elements.btnClose.addEventListener('click', closeModal);
    
    elements.btnSave.addEventListener('click', async () => {
        const tableName = modal.dataset.tableName;
        const filterData = readRuleState(modal.querySelector('#cv-filter-builder-container div'));
        const formFields = Array.from(formLayoutPanel.querySelectorAll('.form-field-item')).map(item => ({
            sourceTable: item.dataset.sourceTable,
            sourceName: item.dataset.sourceName,
            label: item.querySelector('.field-label').textContent,
            isReadonly: item.querySelector('.is-readonly-checkbox').checked,
        }));
        const dataToSave = {
            custom_view_id: document.getElementById('cv-view-id').value || null,
            table_id: jsonData.database.table[tableName].table_id,
            view_name: document.getElementById('cv-view-name').value.trim(),
            menu_icon: document.getElementById('cv-menu-icon').value.trim(),
            filter_rules: JSON.stringify(filterData),
            fields: formFields,
            owner_only: document.getElementById('cv-owner-only-checkbox').checked ? 1 : 0,
            owner_field: document.getElementById('cv-owner-field-select').value,
        };
        const result = await window.electronAPI.saveCustomView(dataToSave);
        if (result.success) {
            closeModal();
            await loadProjectData(activeProject);
            populateCustomViewsTab(tableName);
        } else {
            showCustomDialog({ title: "Save Error", message: `Failed to save Custom View: ${result.message}` });
        }
    });

    modal.dataset.listenersAttached = 'true';
}

/**
 * HANYA membina dan memaparkan struktur pokok untuk senarai medan yang boleh dipilih.
 * @param {string} currentTableName - Nama jadual semasa.
 */
function populateAvailableFieldsTree(currentTableName) {
    const listContainer = document.getElementById('cv-available-fields-list');
    const formLayoutPanel = document.getElementById('cv-form-layout-panel');
    listContainer.innerHTML = '';

    const relationships = jsonData.database.relationships;
    const allTables = jsonData.database.table;
    const fieldsInLayout = Array.from(formLayoutPanel.querySelectorAll('.form-field-item')).map(
        item => `${item.dataset.sourceTable}.${item.dataset.sourceName}`
    );

    const findAncestors = (tableName, level = 0) => {
        if (level > 2) return [];
        let ancestors = [];
        const parentRelations = relationships.filter(r => r.child_table_name === tableName);
        parentRelations.forEach(rel => {
            ancestors.push({ name: rel.parent_table_name, relation: 'Parent' });
            ancestors = ancestors.concat(findAncestors(rel.parent_table_name, level + 1));
        });
        return ancestors;
    };

    const tablesToShow = [{ name: currentTableName, relation: 'Current' }, ...findAncestors(currentTableName)];
    const uniqueTables = [...new Map(tablesToShow.map(item => [item['name'], item])).values()];

    uniqueTables.forEach(tableInfo => {
        const tableData = allTables[tableInfo.name];
        if (!tableData) return;

        const tableNode = document.createElement('li');
        tableNode.className = 'table-node';
        tableNode.innerHTML = `<span><i class="fas fa-chevron-down"></i> ${tableInfo.name} <small>(${tableInfo.relation})</small></span>`;
        
        const fieldList = document.createElement('ul');
        fieldList.className = 'field-list';

        Object.keys(tableData.fields).forEach(fieldName => {
            const qualifiedName = `${tableInfo.name}.${fieldName}`;
            // Hanya papar jika medan ini TIADA dalam panel kanan
            if (!fieldsInLayout.includes(qualifiedName)) {
                const fieldItem = document.createElement('li');
                fieldItem.className = 'field-item';
                fieldItem.textContent = fieldName;
                fieldItem.dataset.sourceTable = tableInfo.name;
                fieldItem.dataset.sourceName = fieldName;
                fieldItem.dataset.isParent = tableInfo.relation !== 'Current';
                fieldList.appendChild(fieldItem);
            }
        });
        
        if (fieldList.children.length > 0) {
            tableNode.appendChild(fieldList);
            listContainer.appendChild(tableNode);
        }
    });

    listContainer.querySelectorAll('.table-node > span').forEach(span => {
        span.addEventListener('click', () => {
            span.parentElement.classList.toggle('collapsed');
            span.nextElementSibling.classList.toggle('hidden');
        });
    });
}


/**
 * Mengisi Form Builder dengan medan-medan sedia ada (untuk mod edit).
 * @param {Array} fields - Senarai objek medan dari viewData.
 */
function populateFormBuilder(fields) {
    const formLayoutPanel = document.getElementById('cv-form-layout-panel');
    const emptyState = formLayoutPanel.querySelector('.empty-state-label');
    if (emptyState) emptyState.remove();

    fields.forEach(field => {
        const fieldData = {
            sourceTable: field.field_source_table,
            sourceName: field.field_source_name,
            isParent: field.field_source_table !== formLayoutPanel.closest('.modal-overlay').dataset.tableName,
            isReadonly: field.is_readonly === 1
        };
        createFormFieldInLayout(fieldData, formLayoutPanel);
    });
    updateFormFieldMoveButtons(formLayoutPanel);
}

/**
 * Mencipta satu elemen medan di dalam panel Form Layout.
 * @param {object} fieldData - Dataset dari elemen medan asal.
 * @param {HTMLElement} layoutPanel - Elemen panel Form Layout.
 */
function createFormFieldInLayout(fieldData, layoutPanel) {
    const emptyState = layoutPanel.querySelector('.empty-state-label');
    if (emptyState) emptyState.remove();

    const template = document.getElementById('cv-form-field-template');
    const clone = template.content.cloneNode(true);
    const formFieldItem = clone.querySelector('.form-field-item');
    
    formFieldItem.dataset.sourceTable = fieldData.sourceTable;
    formFieldItem.dataset.sourceName = fieldData.sourceName;
    clone.querySelector('.field-label').textContent = fieldData.sourceName;
    clone.querySelector('.field-source').textContent = `${fieldData.sourceTable}.${fieldData.sourceName}`;
    clone.querySelector('.is-readonly-checkbox').checked = (fieldData.isParent === 'true' || fieldData.isParent === true || fieldData.isReadonly === true);
    
    layoutPanel.appendChild(clone);
}

/**
 * Mengemas kini status (disabled/enabled) untuk butang naik/turun bagi setiap medan.
 * @param {HTMLElement} formLayoutPanel - Elemen panel Form Layout.
 */
function updateFormFieldMoveButtons(formLayoutPanel) {
    const items = formLayoutPanel.querySelectorAll('.form-field-item');
    if (items.length === 0 && !formLayoutPanel.querySelector('.empty-state-label')) {
        formLayoutPanel.innerHTML = `<div class="empty-state-label"><p>No fields selected</p></div>`;
    }

    items.forEach((item, index) => {
        const upBtn = item.querySelector('.move-up-btn');
        const downBtn = item.querySelector('.move-down-btn');
        if (upBtn) upBtn.disabled = (index === 0);
        if (downBtn) downBtn.disabled = (index === items.length - 1);
    });
}