// src/js/handlers/logicBuilderHandlers.js

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';
import { showCustomDialog } from '../ui/modalHandlers.js';
import { setElementValue } from '../ui/formHelpers.js';

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
            
            const fieldData = appState.jsonData.database.table[tableName]?.fields[rule.field];
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
            const tableData = appState.jsonData.database.table[tableName];
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
        const relationship = appState.jsonData.database.relationships.find(
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
        const allRelationships = appState.jsonData.database.relationships;
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
                fieldData = appState.jsonData.database.table[tableName]?.fields[fieldName];
            } else { // 'standard' rule
                tableName = childTable;
                fieldName = rule.field;
                fieldData = appState.jsonData.database.table[tableName]?.fields[fieldName];
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
                    const fields = appState.jsonData.database.table[activeTable].fields;
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

                    const relationship = appState.jsonData.database.relationships.find(
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
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
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
            const tableData = appState.jsonData.database.table[tableName];
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
                const fields = Object.keys(appState.jsonData.database.table[tableName]?.fields || {});

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
                             const rel = appState.jsonData.database.relationships.find(r => r.parent_table_name === context.tableName && r.child_table_name === itemData.table);
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
                                        appState.jsonData.database.relationships.forEach(rel => {
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
                                        const fields = appState.jsonData.database.table[ruleData.table]?.fields || {};
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
                                        const childFields = appState.jsonData.database.table[itemData.table]?.fields || {};
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
                        const fields = Object.keys(appState.jsonData.database.table[itemData.table]?.fields || {});
                        
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
                const allOtherTables = Object.keys(appState.jsonData.database.table).filter(t => t !== activeTable);
                allOtherTables.forEach(tableName => {
                    const option = document.createElement('option');
                    option.value = tableName;
                    option.textContent = tableName;
                    tableSelect.appendChild(option);
                });

                const populateFields = (tableName) => {
                    fieldSelect.innerHTML = '';
                    if (appState.jsonData.database.table[tableName]) {
                        const fields = Object.keys(appState.jsonData.database.table[tableName].fields);
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
                const fields = appState.jsonData.database.table[activeTable]?.fields || {};
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
                const childRelationships = appState.jsonData.database.relationships.filter(r => r.parent_table_name === parentTable);
                
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
                const childRelationships = appState.jsonData.database.relationships.filter(r => r.parent_table_name === parentTable);

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
                const allTables = Object.keys(appState.jsonData.database.table);
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
                    if (appState.jsonData.database.table[tableName]) {
                        const fields = Object.keys(appState.jsonData.database.table[tableName].fields);
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
                Object.keys(appState.jsonData.database.table).forEach(t => tableSelect.add(new Option(t, t)));
                break;
            }
            case 'update_record': {
                const template = document.getElementById('db-action-update-template');
                itemContainer.appendChild(template.content.cloneNode(true));
                const tableSelect = itemContainer.querySelector('.table-select');
                Object.keys(appState.jsonData.database.table).forEach(t => tableSelect.add(new Option(t, t)));
                const uniqueId = `logic_${Date.now()}`;
                itemContainer.querySelectorAll('input[type="radio"]').forEach(radio => radio.name = `cqb-logic-${uniqueId}`);
                break;
            }
            case 'delete_record': {
                const template = document.getElementById('db-action-delete-template');
                itemContainer.appendChild(template.content.cloneNode(true));
                const tableSelect = itemContainer.querySelector('.table-select');
                Object.keys(appState.jsonData.database.table).forEach(t => tableSelect.add(new Option(t, t)));
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
                const childFields = appState.jsonData.database.table[childTable]?.fields || {};
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
                appState.jsonData.database.relationships.forEach(rel => {
                    if (rel.parent_table_name === childTable) relatedTables.add(rel.child_table_name);
                    if (rel.child_table_name === childTable) relatedTables.add(rel.parent_table_name);
                });

                const tableDropdown = ruleEl.querySelector('.cqb-rule-table');
                const fieldDropdown = ruleEl.querySelector('.cqb-rule-field');

                relatedTables.forEach(t => tableDropdown.innerHTML += `<option value="${t}">${t}</option>`);

                const populateJoinFields = (selectedTable) => {
                    fieldDropdown.innerHTML = '';
                    const fields = appState.jsonData.database.table[selectedTable]?.fields || {};
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

                Object.keys(appState.jsonData.database.table[externalTableName].fields).forEach(f => {
                    externalFieldSelect.innerHTML += `<option value="${f}">${f}</option>`;
                });

                Object.keys(appState.jsonData.database.table[currentTableName].fields).forEach(f => {
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
            if (!table || !appState.jsonData.database.table[table]) return;

            // BUG FIX #3: Prevent duplicate fields
            const usedFields = new Set(Array.from(list.querySelectorAll('.field-select')).map(sel => sel.value));
            const availableFields = Object.keys(appState.jsonData.database.table[table].fields).filter(f => !usedFields.has(f));

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
            const fields = Object.keys(appState.jsonData.database.table[table]?.fields || {});
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
            if (!table || !appState.jsonData.database.table[table]) return;

            const fields = Object.keys(appState.jsonData.database.table[table].fields);

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
                // Tukar kepada 'change'
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            closeModal();
        });

    newCancelBtn.addEventListener('click', closeModal);
    newCloseBtn.addEventListener('click', closeModal);

    modal.classList.remove('hidden');
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
        const tableData = appState.jsonData.database.table[config.tableName];
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
    
    // Gunakan 'replaceWith' clone untuk elak event listener bertindih jika fungsi dipanggil berulang kali
    if (openBtn) {
        const newOpenBtn = openBtn.cloneNode(true);
        openBtn.parentNode.replaceChild(newOpenBtn, openBtn);
        
        newOpenBtn.addEventListener('click', () => {
            // Dapatkan konteks jadual dan medan semasa
            const fieldNameEl = document.querySelector('#field-settings-page .field-name');
            if (!fieldNameEl) return;

            const [tableName, fieldName] = fieldNameEl.textContent.split('.') || [];
            
            if (!tableName || !fieldName) {
                 showCustomDialog({ title: "Error", message: "Please select a field first." });
                 return;
            }
            
            // Dapatkan data medan dari state
            const fieldData = appState.jsonData.database.table[tableName]?.fields[fieldName];
            
            showConfigurableQueryBuilder({
                mode: 'calculation',
                tableName: tableName,
                fieldName: fieldName,
                initialState: fieldData?.calculation_builder_state || null,
                onComplete: (sql, state) => {
                    // ▼▼▼ PEMBAIKAN: KEMAS KINI UI SECARA MANUAL ▼▼▼
                    
                    // 1. Masukkan Query ke dalam Textarea
                    const queryInput = document.getElementById('fld-calculated-query');
                    if (queryInput) {
                        queryInput.value = sql;
                        // Trigger event 'change' supaya UI lain yang bergantung kepadanya tahu ada perubahan
                        queryInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    // 2. Auto-check checkbox "Enable Calculation" (jika ada)
                    const enableCheckbox = document.getElementById('fld-calculated-enable');
                    if (enableCheckbox && !enableCheckbox.checked) {
                        enableCheckbox.checked = true;
                        // Trigger event supaya field 'Calculated Query' muncul (jika tersembunyi)
                        enableCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    // ▲▲▲ TAMAT PEMBAIKAN ▲▲▲

                    // 3. Simpan ke Backend (SaveManager)
                    SaveManager.addToQueue('fields', fieldData.field_id, {
                        calculated_query: sql,
                        calculation_builder_state: state,
                        calculated_enable: 1 
                    });
                }
            });
        });
    }
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
            if (!fieldDropdown || !appState.jsonData.database.table[selectedTable]) return;
            fieldDropdown.innerHTML = '';
            const fields = Object.keys(appState.jsonData.database.table[selectedTable].fields);
            fields.forEach(fieldName => {
                const option = document.createElement('option'); option.value = fieldName; option.textContent = fieldName;
                fieldDropdown.appendChild(option);
            });
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
            const tableData = appState.jsonData.database.table[tableName];
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
        appState.jsonData.database.relationships.forEach(rel => {
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
    const allTables = Object.keys(appState.jsonData.database.table);
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
 * Membuka dan menguruskan modal konfigurasi Custom View (untuk tambah/edit).
 * @param {string} tableName - Nama jadual semasa.
 * @param {object|null} viewData - Data untuk view sedia ada jika dalam mod edit.
 */
// src/js/handlers/logicBuilderHandlers.js

export function openCustomViewModal(tableName, viewData = null) {
    const modal = document.getElementById('custom-view-config-modal');
    if (!modal) {
        console.error("Modal 'custom-view-config-modal' tidak ditemui.");
        return;
    }

    modal.dataset.tableName = tableName;
    
    // 1. Rujukan Elemen
    const elements = {
        title: document.getElementById('cv-modal-title'),
        viewIdInput: document.getElementById('cv-view-id'),
        viewNameInput: document.getElementById('cv-view-name'),
        menuIconInput: document.getElementById('cv-menu-icon'),
        
        childTablesContainer: document.getElementById('cv-child-tables-container'),
        
        filterContainer: document.getElementById('cv-filter-builder-container'), // Container Filter
        
        ownerOnlyCheckbox: document.getElementById('cv-owner-only-checkbox'),
        ownerFieldContainer: document.getElementById('cv-owner-field-container'),
        ownerFieldSelect: document.getElementById('cv-owner-field-select'),
        
        nextBtn: document.getElementById('cv-modal-next'),
        backBtn: document.getElementById('cv-modal-back'),
        saveBtn: document.getElementById('cv-modal-save'),
        closeIcon: document.getElementById('cv-modal-close'),
        cancelBtn: document.getElementById('cv-modal-cancel'),
        
        step1: document.getElementById('cv-step-1'),
        step2: document.getElementById('cv-step-2'),
        
        addFieldBtn: document.getElementById('cv-add-field-btn'),
        removeFieldBtn: document.getElementById('cv-remove-field-btn'),
        availableList: document.getElementById('cv-available-fields-list'),
        layoutPanel: document.getElementById('cv-form-layout-panel')
    };

    // 2. Setup Data Awal & Reset UI
    const isEditing = viewData !== null;
    elements.title.textContent = isEditing ? `Edit Custom View: ${viewData.view_name}` : `Create New Custom View for '${tableName}'`;
    elements.viewIdInput.value = isEditing ? viewData.custom_view_id : '';
    elements.viewNameInput.value = isEditing ? viewData.view_name : '';
    elements.menuIconInput.value = isEditing ? viewData.menu_icon || 'fas fa-table' : 'fas fa-table';
    
    elements.viewNameInput.classList.remove('is-invalid');
    const valMsg = document.getElementById('cv-name-validation-message');
    if (valMsg) valMsg.style.display = 'none';

    // Reset Save Button
    elements.saveBtn.disabled = false;
    elements.saveBtn.innerHTML = 'Save View';

    // Populate Owner Field
    if (elements.ownerFieldSelect) {
        elements.ownerFieldSelect.innerHTML = '';
        const fields = appState.jsonData.database.table[tableName]?.fields || {};
        Object.keys(fields).forEach(fieldName => {
            elements.ownerFieldSelect.add(new Option(fieldName, fieldName));
        });
    }

    // Owner Checkbox Logic
    if (elements.ownerOnlyCheckbox) {
        elements.ownerOnlyCheckbox.checked = isEditing && viewData.owner_only === 1;
        if (elements.ownerFieldContainer) {
            elements.ownerFieldContainer.classList.toggle('hidden', !elements.ownerOnlyCheckbox.checked);
        }
        
        const newOwnerCheck = elements.ownerOnlyCheckbox.cloneNode(true);
        elements.ownerOnlyCheckbox.parentNode.replaceChild(newOwnerCheck, elements.ownerOnlyCheckbox);
        elements.ownerOnlyCheckbox = newOwnerCheck;
        
        elements.ownerOnlyCheckbox.addEventListener('change', (e) => {
            if(elements.ownerFieldContainer) 
                elements.ownerFieldContainer.classList.toggle('hidden', !e.target.checked);
        });
    }

    if (isEditing && viewData.owner_field && elements.ownerFieldSelect) {
        elements.ownerFieldSelect.value = viewData.owner_field;
    }

    // FASA 1: Child Tables Logic (Kekal Sama)
    if (elements.childTablesContainer) {
        elements.childTablesContainer.innerHTML = '';
        const relationships = appState.jsonData.database.relationships.filter(
            rel => rel.parent_table_name === tableName
        );

        if (relationships.length === 0) {
            elements.childTablesContainer.innerHTML = '<span style="font-style:italic; color:#999; font-size:0.85em; padding:5px;">No child tables found.</span>';
        } else {
            let savedRelations = [];
            if (isEditing && viewData.included_relations) {
                try {
                    savedRelations = typeof viewData.included_relations === 'string' 
                        ? JSON.parse(viewData.included_relations) 
                        : viewData.included_relations;
                } catch (e) { console.error("Error parsing included_relations", e); }
            }

            relationships.forEach(rel => {
                const wrapper = document.createElement('div');
                wrapper.className = 'checkbox-item';
                wrapper.style.cssText = 'display:flex; align-items:center; gap:8px;';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `rel-check-${rel.relationship_id}`;
                checkbox.value = rel.child_table_name; 
                checkbox.checked = !isEditing ? true : savedRelations.includes(rel.child_table_name);
                const label = document.createElement('label');
                label.htmlFor = `rel-check-${rel.relationship_id}`;
                label.textContent = rel.child_table_name;
                label.style.cursor = 'pointer';
                wrapper.appendChild(checkbox);
                wrapper.appendChild(label);
                elements.childTablesContainer.appendChild(wrapper);
            });
        }
    }

    // ---------------------------------------------------------
    // FASA 2: FILTER BUILDER INITIALIZATION
    // ---------------------------------------------------------
    if (elements.filterContainer) {
        elements.filterContainer.innerHTML = ''; // Reset container
        
        // 1. Bina struktur asas (Root Group) atau Nested Rules Wrapper
        const filterBuilderWrapper = document.createElement('div');
        filterBuilderWrapper.className = 'qb-nested-rules'; 
        filterBuilderWrapper.style.padding = '5px';
        elements.filterContainer.appendChild(filterBuilderWrapper);
        
        // 2. Load Data (Jika Edit)
        const filterState = isEditing ? JSON.parse(viewData.filter_rules || '{}') : null;
        if (filterState && filterState.rules && filterState.rules.length > 0) {
            // Gunakan fungsi sedia ada untuk bina UI recursive
            buildRulesUI(filterBuilderWrapper, filterState, tableName);
        }
        
        // 3. Tambah butang "Add Rule" utama di bawah
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'mt-2';
        buttonContainer.innerHTML = `
            <button class="btn btn-secondary btn-sm cqb-add-nested-rule"><i class="fas fa-plus"></i> Add Rule</button>
            <button class="btn btn-secondary btn-sm cqb-add-nested-group"><i class="fas fa-layer-group"></i> Add Group</button>
        `;
        elements.filterContainer.appendChild(buttonContainer);

        // =========================================================
        // FASA 2: FILTER BUILDER EVENT LISTENERS (DELEGATION)
        // =========================================================
        
        // Clone container untuk buang listener lama (Critical for SPA)
        const newFilterContainer = elements.filterContainer.cloneNode(true);
        elements.filterContainer.parentNode.replaceChild(newFilterContainer, elements.filterContainer);
        elements.filterContainer = newFilterContainer;

        // Listener A: Klik (Tambah Rule/Group, Delete)
        elements.filterContainer.addEventListener('click', (e) => {
            const target = e.target;
            const button = target.closest('button'); // Handle ikon dalam butang

            if (!button) return;

            if (button.classList.contains('cqb-add-nested-rule')) {
                e.preventDefault();
                addRuleOrGroup(button, 'rule');
            } else if (button.classList.contains('cqb-add-nested-group')) {
                e.preventDefault();
                addRuleOrGroup(button, 'group');
            } else if (button.classList.contains('cqb-delete-btn')) {
                e.preventDefault();
                const itemToRemove = button.closest('.cqb-rule, .cqb-rule-group');
                if (itemToRemove) itemToRemove.remove();
            }
        });

        // Listener B: Perubahan (Table Select -> Update Fields)
        elements.filterContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('cqb-rule-table')) {
                const selectedTable = e.target.value;
                const fieldDropdown = e.target.closest('.cqb-rule').querySelector('.cqb-rule-field');
                
                if (fieldDropdown && appState.jsonData.database.table[selectedTable]) {
                    fieldDropdown.innerHTML = ''; // Kosongkan
                    const fields = Object.keys(appState.jsonData.database.table[selectedTable].fields);
                    fields.forEach(fieldName => {
                        const option = document.createElement('option');
                        option.value = fieldName;
                        option.textContent = fieldName;
                        fieldDropdown.appendChild(option);
                    });
                }
            }
        });
    }

    // 4. Setup Form Builder & Steps UI (Kekal Sama)

if (elements.layoutPanel) {
        // Reset panel kanan
        elements.layoutPanel.innerHTML = `<div class="empty-state-label"><p>Drag fields here</p></div>`;
        
        // Jika Mode Edit, isikan panel kanan dengan medan yang disimpan
        if (isEditing && viewData.fields) {
            populateFormBuilder(viewData.fields);
        }
    }
    
    populateAvailableFieldsTree(tableName);
    
    // Reset Navigation Logic
    elements.step1.classList.remove('hidden');
    elements.step2.classList.add('hidden');
    elements.backBtn.classList.add('hidden');
    elements.saveBtn.classList.add('hidden');
    elements.nextBtn.classList.remove('hidden');
    elements.nextBtn.disabled = !isEditing;

    const validateName = () => {
        const isValid = elements.viewNameInput.value.trim().length > 0;
        elements.nextBtn.disabled = !isValid;
        if (isValid) elements.viewNameInput.classList.remove('is-invalid');
    };

    const newNameInput = elements.viewNameInput.cloneNode(true);
    elements.viewNameInput.parentNode.replaceChild(newNameInput, elements.viewNameInput);
    elements.viewNameInput = newNameInput;
    elements.viewNameInput.addEventListener('input', validateName);

    // Navigation Handlers
    const handleNext = () => {
        if (elements.viewNameInput.value.trim() === '') {
            elements.viewNameInput.classList.add('is-invalid');
            return;
        }
        elements.step1.classList.add('hidden');
        elements.step2.classList.remove('hidden');
        elements.backBtn.classList.remove('hidden');
        elements.saveBtn.classList.remove('hidden');
        elements.nextBtn.classList.add('hidden');
    };

    const handleBack = () => {
        elements.step2.classList.add('hidden');
        elements.step1.classList.remove('hidden');
        elements.backBtn.classList.add('hidden');
        elements.saveBtn.classList.add('hidden');
        elements.nextBtn.classList.remove('hidden');
    };

    const newNextBtn = elements.nextBtn.cloneNode(true);
    elements.nextBtn.parentNode.replaceChild(newNextBtn, elements.nextBtn);
    elements.nextBtn = newNextBtn;
    elements.nextBtn.addEventListener('click', handleNext);

    const newBackBtn = elements.backBtn.cloneNode(true);
    elements.backBtn.parentNode.replaceChild(newBackBtn, elements.backBtn);
    elements.backBtn = newBackBtn;
    elements.backBtn.addEventListener('click', handleBack);

    // Field Picker Logic
    if (elements.addFieldBtn) {
        const newAddBtn = elements.addFieldBtn.cloneNode(true);
        elements.addFieldBtn.parentNode.replaceChild(newAddBtn, elements.addFieldBtn);
        newAddBtn.addEventListener('click', () => {
            const selectedItems = elements.availableList.querySelectorAll('.field-item.selected');
            if (selectedItems.length === 0) return;
            selectedItems.forEach(item => {
                const fieldData = {
                    sourceTable: item.dataset.sourceTable,
                    sourceName: item.dataset.sourceName,
                    isParent: item.dataset.isParent === 'true',
                    isReadonly: false
                };
                createFormFieldInLayout(fieldData, elements.layoutPanel);
                item.remove(); 
            });
            updateFormFieldMoveButtons(elements.layoutPanel);
        });
    }

    if (elements.removeFieldBtn) {
        const newRemoveBtn = elements.removeFieldBtn.cloneNode(true);
        elements.removeFieldBtn.parentNode.replaceChild(newRemoveBtn, elements.removeFieldBtn);
        newRemoveBtn.addEventListener('click', () => {
            const selectedItems = elements.layoutPanel.querySelectorAll('.form-field-item.selected');
            if (selectedItems.length === 0) return;
            selectedItems.forEach(item => item.remove());
            populateAvailableFieldsTree(tableName);
            updateFormFieldMoveButtons(elements.layoutPanel);
        });
    }

    // Modal Close
    const closeModal = () => modal.classList.add('hidden');
    if (elements.closeIcon) {
        const newCloseIcon = elements.closeIcon.cloneNode(true);
        elements.closeIcon.parentNode.replaceChild(newCloseIcon, elements.closeIcon);
        newCloseIcon.addEventListener('click', closeModal);
    }
    if (elements.cancelBtn) {
        const newCancelBtn = elements.cancelBtn.cloneNode(true);
        elements.cancelBtn.parentNode.replaceChild(newCancelBtn, elements.cancelBtn);
        newCancelBtn.addEventListener('click', closeModal);
    }

    // SAVE HANDLER
    const handleSave = async () => {
        try {
            const tableData = appState.jsonData.database.table[tableName];
            const tableId = tableData.table_id;
            const viewName = elements.viewNameInput.value.trim();
            if (!viewName) return;

            // Kumpul Filter Rules (FASA 2)
            let filterRules = {};
            // Kita baca dari wrapper root jika ada, atau dari container direct
            // Fungsi readRuleState membaca struktur DOM .cqb-rule dan .cqb-rule-group
            if (elements.filterContainer) {
                // Untuk keseragaman, kita cuba baca dari .qb-nested-rules pertama
                const rootWrapper = elements.filterContainer.querySelector('.qb-nested-rules');
                if (rootWrapper) {
                    // Kita perlu balut dalam objek "group" maya kerana readRuleState membaca children
                    filterRules = readRuleState(rootWrapper); 
                    // Nota: readRuleState perlukan struktur parent logic toggle. 
                    // Jika readRuleState gagal, kita mungkin perlu pass element container terus.
                    // Mari kita pastikan readRuleState flexible.
                } else {
                    // Fallback jika user tambah rule direct ke container utama
                   // Logic ini bergantung kepada bagaimana addRuleOrGroup berfungsi
                }
            }

            // *PENTING*: readRuleState menjangka container yang ada .qb-logic-toggle sebelumnya.
            // Oleh itu, kita pastikan kita ambil state dengan betul.
            // Cara paling selamat adalah memastikan filter kita sentiasa bermula dengan satu 'group' maya
            // Atau kita ubah suai readRuleState. Untuk sekarang, 'qb-nested-rules' sepatutnya OK.

            const fields = [];
            if (elements.layoutPanel) {
                elements.layoutPanel.querySelectorAll('.form-field-item').forEach((item, index) => {
                    fields.push({
                        sourceTable: item.dataset.sourceTable,
                        sourceName: item.dataset.sourceName,
                        label: item.querySelector('.field-label')?.textContent || item.dataset.sourceName,
                        isReadonly: item.querySelector('.is-readonly-checkbox').checked,
                        sortOrder: index
                    });
                });
            }

            const selectedRelations = [];
            if (elements.childTablesContainer) {
                const checkboxes = elements.childTablesContainer.querySelectorAll('input[type="checkbox"]:checked');
                checkboxes.forEach(cb => {
                    selectedRelations.push(cb.value);
                });
            }

            const payload = {
                custom_view_id: isEditing ? viewData.custom_view_id : null,
                table_id: tableId,
                view_name: viewName,
                menu_icon: elements.menuIconInput.value,
                owner_only: elements.ownerOnlyCheckbox && elements.ownerOnlyCheckbox.checked ? 1 : 0,
                owner_field: elements.ownerFieldSelect ? elements.ownerFieldSelect.value : null,
                included_relations: JSON.stringify(selectedRelations),
                filter_rules: JSON.stringify(filterRules), // Simpan FASA 2 Data
                fields: fields
            };

            const originalBtnText = elements.saveBtn.innerHTML;
            elements.saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            elements.saveBtn.disabled = true;

            const result = await window.electronAPI.saveCustomView(payload);

            if (result && result.success) {
                console.log("✅ Save Berjaya");
                
                if (!appState.jsonData.database.table[tableName].custom_views) {
                    appState.jsonData.database.table[tableName].custom_views = [];
                }

                if (isEditing) {
                    const index = appState.jsonData.database.table[tableName].custom_views.findIndex(v => v.custom_view_id === viewData.custom_view_id);
                    if (index !== -1) appState.jsonData.database.table[tableName].custom_views[index] = result.view; 
                } else {
                    appState.jsonData.database.table[tableName].custom_views.push(result.view);
                }

                elements.saveBtn.innerHTML = 'Save View';
                elements.saveBtn.disabled = false;
                closeModal();

                if (typeof window.populateCustomViewsTab === 'function') {
                    window.populateCustomViewsTab(tableName);
                }

            } else {
                showCustomDialog({ title: "Error", message: result.message || "Failed to save." });
                elements.saveBtn.innerHTML = originalBtnText;
                elements.saveBtn.disabled = false;
            }

        } catch (error) {
            console.error("Save Error:", error);
            showCustomDialog({ title: "Error", message: "An error occurred: " + error.message });
            elements.saveBtn.disabled = false;
            elements.saveBtn.innerHTML = 'Save View';
        }
    };
    
    const newSaveBtn = elements.saveBtn.cloneNode(true);
    elements.saveBtn.parentNode.replaceChild(newSaveBtn, elements.saveBtn);
    elements.saveBtn = newSaveBtn;
    elements.saveBtn.addEventListener('click', handleSave);

    modal.classList.remove('hidden');
}

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
    const parentTableData = appState.jsonData.database.table[parentTable];
    const pkField = Object.keys(parentTableData.fields).find(f => parentTableData.fields[f].primary_key) || 'id';

    return `SELECT \`${parentTable}\`.\`${pkField}\`, ${captionFields} FROM \`${parentTable}\` ORDER BY 2`;
}

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
    const allRelationships = appState.jsonData.database.relationships;
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

function setupBuilderUI(tableName) {
    const numericTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'];
    const fields = appState.jsonData.database.table[tableName].fields;
    
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
    const pkField = Object.keys(appState.jsonData.database.table[tableName].fields).find(f => appState.jsonData.database.table[tableName].fields[f].primary_key === 1);
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
    const relationships = appState.jsonData.database.relationships || [];
    const relatedTables = new Set([tableName]);
    relationships.forEach(rel => {
        if (rel.parent_table_name === tableName) relatedTables.add(rel.child_table_name);
        if (rel.child_table_name === tableName) relatedTables.add(rel.parent_table_name);
    });
    const tableOptions = Array.from(relatedTables).map(t => `<option value="${t}">${t}</option>`).join('');
    const initialTable = data ? data.table : tableName;
    const fields = appState.jsonData.database.table[initialTable]?.fields || {};
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
    const fields = Object.keys(appState.jsonData.database.table[tableName]?.fields || {});
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
            const fieldData = appState.jsonData.database.table[table]?.fields[field];
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

// src/js/handlers/logicBuilderHandlers.js

function addRuleOrGroup(button, type) {
    // Cari container bapa terdekat. Kita tambah '#cv-filter-builder-container' untuk support Custom View.
    const parentContainer = button.closest('.cqb-rule-group, #cqb-container, #cv-filter-builder-container');
    
    if (!parentContainer) return; 

    // Cari kawasan di mana rule baru patut dimasukkan
    // Untuk Custom View, ia mungkin direct di bawah container atau dalam nested rules
    const targetContainer = parentContainer.querySelector('.qb-nested-rules, #cqb-rules-container') || parentContainer.querySelector('.qb-nested-rules') || parentContainer;

    // Cari modal terdekat untuk dapatkan Table Name
    const modal = button.closest('#configurable-query-builder-modal, #custom-view-config-modal');
    if (!modal) return;
    
    const tableName = modal.dataset.tableName;
    
    if (targetContainer) {
        if(type === 'rule') {
            const newRule = createRuleElement(tableName);
            targetContainer.appendChild(newRule);
            
            // Logik Kosmetik: Jika ini rule pertama dalam container kosong, buang butang "Add Rule" placeholder (jika ada)
            // (Bergantung pada struktur HTML anda, kadang-kadang ini tidak perlu, tapi selamat diletakkan)
            const initialAddButton = parentContainer.querySelector(':scope > .cqb-add-nested-rule');
            if (initialAddButton && initialAddButton.parentElement === parentContainer && parentContainer.id === 'cv-filter-builder-container') {
                // Jangan buang butang utama, biarkan ia di situ untuk tambah rule seterusnya
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
 * HANYA membina dan memaparkan struktur pokok untuk senarai medan yang boleh dipilih.
 * @param {string} currentTableName - Nama jadual semasa.
 */
function populateAvailableFieldsTree(currentTableName) {
    const listContainer = document.getElementById('cv-available-fields-list');
    const formLayoutPanel = document.getElementById('cv-form-layout-panel');
    listContainer.innerHTML = '';

    const relationships = appState.jsonData.database.relationships;
    const allTables = appState.jsonData.database.table;
    
    // Dapatkan senarai field yang SUDAH ada di kanan supaya tidak diduplikasi
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
                
                // ▼▼▼ PEMBAIKAN: Tambah Listener Klik untuk Highlight ▼▼▼
                fieldItem.addEventListener('click', (e) => {
                    // Benarkan multi-select dengan Ctrl/Cmd, jika tidak, toggle biasa
                    if (!e.ctrlKey && !e.metaKey) {
                        // Jika mahu single select sahaja, buang class selected dari yang lain:
                        // listContainer.querySelectorAll('.field-item.selected').forEach(el => el.classList.remove('selected'));
                    }
                    fieldItem.classList.toggle('selected');
                });
                // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
                
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

    // Dapatkan nama jadual semasa untuk perbandingan logic 'isParent'
    const modal = formLayoutPanel.closest('.modal-overlay');
    const currentTableName = modal ? modal.dataset.tableName : '';

    fields.forEach(field => {
        // --- FIX: Sokong kedua-dua format key (DB snake_case vs Frontend camelCase) ---
        const sourceTable = field.field_source_table || field.sourceTable;
        const sourceName = field.field_source_name || field.sourceName;
        
        // Handle is_readonly (DB guna 1/0, Frontend mungkin true/false)
        let isReadonly = false;
        if (field.is_readonly !== undefined) isReadonly = (field.is_readonly == 1);
        else if (field.isReadonly !== undefined) isReadonly = (field.isReadonly === true);

        // Hanya cipta jika data kritikal wujud
        if (sourceTable && sourceName) {
            const fieldData = {
                sourceTable: sourceTable,
                sourceName: sourceName,
                // Semak jika table medan ini TIDAK SAMA dengan table semasa = Parent Field
                isParent: sourceTable !== currentTableName,
                isReadonly: isReadonly
            };
            createFormFieldInLayout(fieldData, formLayoutPanel);
        }
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
    
    // Pastikan kita guna selector yang betul dalam template clone
    const labelEl = formFieldItem.querySelector('.field-label') || clone.querySelector('.field-label');
    const sourceEl = formFieldItem.querySelector('.field-source') || clone.querySelector('.field-source');
    const checkEl = formFieldItem.querySelector('.is-readonly-checkbox') || clone.querySelector('.is-readonly-checkbox');

    if(labelEl) labelEl.textContent = fieldData.sourceName;
    if(sourceEl) sourceEl.textContent = `${fieldData.sourceTable}.${fieldData.sourceName}`;
    if(checkEl) checkEl.checked = (fieldData.isParent === 'true' || fieldData.isParent === true || fieldData.isReadonly === true);
    
    // ▼▼▼ PEMBAIKAN: Tambah Listener Klik untuk item di Canvas Kanan ▼▼▼
    formFieldItem.addEventListener('click', () => {
        formFieldItem.classList.toggle('selected');
    });
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

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
