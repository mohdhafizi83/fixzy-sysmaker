/**
 * Starter Pack manifest validator tests.
 * Run: node test/preset_schema_test.js
 */
'use strict';

const assert = require('assert');
const { validateManifest } = require('../src/core/presetSchema');

let passed = 0;
function t(name, fn) {
    try { fn(); passed++; console.log('  PASS ' + name); }
    catch (e) { console.error('  FAIL ' + name + ': ' + e.message); process.exitCode = 1; }
}

const validManifest = () => ({
    schema_version: 1,
    slug: 'leave-request',
    name: 'Leave Request',
    tagline: 'Employee leave applications with approval',
    category: 'hr',
    caveats: ['Tracking only.'],
    tables: [
        {
            ref: 'leave_types', table_name: 'leave_types', module_name: 'Leave Types',
            fields: [{ field_name: 'type_name', field_type: 'VARCHAR', required: 1 }],
        },
        {
            ref: 'leave_requests', table_name: 'leave_requests', module_name: 'Leave Requests', menu_group: 'Leave',
            fields: [
                { field_name: 'employee_name', field_type: 'VARCHAR', required: 1 },
                { field_name: 'leave_type_id', field_type: 'INT', required: 1 },
                { field_name: 'start_date', field_type: 'DATE', required: 1 },
                { field_name: 'status', field_type: 'VARCHAR', display_type: 'options_list', options_list_values: 'pending|approved|rejected' },
            ],
            table_settings: {
                approval_enabled: 1,
                approval_config: {
                    statusField: 'status',
                    initial: 'pending',
                    statuses: [
                        { key: 'pending', label: 'Pending', color: 'warning', final: false },
                        { key: 'approved', label: 'Approved', color: 'success', final: true },
                        { key: 'rejected', label: 'Rejected', color: 'danger', final: true },
                    ],
                    transitions: [
                        { from: 'pending', to: 'approved', label: 'Approve', roles: '', require_comment: false, notify: 'submitter' },
                        { from: 'pending', to: 'rejected', label: 'Reject', roles: '', require_comment: true, notify: 'submitter' },
                    ],
                },
            },
        },
    ],
    relationships: [{ parent_ref: 'leave_types', child_ref: 'leave_requests', fk_field: 'leave_type_id' }],
    custom_modules: [
        {
            ref: 'my_leaves', base_table_ref: 'leave_requests', module_name: 'My Leave Requests',
            menu_icon: 'fa-solid fa-calendar-check',
            settings_override: { table_view_title: 'My Leaves' },
        },
    ],
    menu: { groups: ['Leave'] },
});

console.log('presetSchema tests');

t('valid manifest passes', () => {
    const r = validateManifest(validManifest());
    assert.ok(r.valid, r.errors.join('; '));
});

t('non-object rejected', () => {
    assert.ok(!validateManifest(null).valid);
    assert.ok(!validateManifest('x').valid);
});

t('bad slug rejected', () => {
    const m = validManifest(); m.slug = 'Leave_Request';
    assert.ok(!validateManifest(m).valid);
});

t('missing name/tagline/category rejected', () => {
    const m = validManifest(); delete m.name; delete m.tagline; delete m.category;
    const r = validateManifest(m);
    assert.ok(!r.valid && r.errors.length >= 3);
});

t('empty tables rejected', () => {
    const m = validManifest(); m.tables = [];
    assert.ok(!validateManifest(m).valid);
});

t('unknown field_type rejected', () => {
    const m = validManifest(); m.tables[0].fields[0].field_type = 'BLOB';
    assert.ok(!validateManifest(m).valid);
});

t('reserved field name rejected', () => {
    const m = validManifest(); m.tables[0].fields.push({ field_name: 'created_at', field_type: 'DATETIME' });
    assert.ok(!validateManifest(m).valid);
});

t('unknown field setting rejected', () => {
    const m = validManifest(); m.tables[0].fields[0].teleport = 1;
    assert.ok(!validateManifest(m).valid);
});

t('unknown table setting key rejected', () => {
    const m = validManifest(); m.tables[1].table_settings.mystery = 1;
    assert.ok(!validateManifest(m).valid);
});

t('dangling relationship ref rejected', () => {
    const m = validManifest(); m.relationships[0].parent_ref = 'ghost';
    assert.ok(!validateManifest(m).valid);
});

t('fk_field missing from child fields rejected', () => {
    const m = validManifest(); m.relationships[0].fk_field = 'not_a_field';
    assert.ok(!validateManifest(m).valid);
});

t('approval_config with undeclared statusField rejected', () => {
    const m = validManifest(); m.tables[1].table_settings.approval_config.statusField = 'nope';
    assert.ok(!validateManifest(m).valid);
});

t('approval transition referencing unknown status rejected', () => {
    const m = validManifest();
    m.tables[1].table_settings.approval_config.transitions[0].to = 'teleported';
    assert.ok(!validateManifest(m).valid);
});

t('all-final statuses rejected', () => {
    const m = validManifest();
    m.tables[1].table_settings.approval_config.statuses.forEach((s) => { s.final = true; });
    assert.ok(!validateManifest(m).valid);
});

t('options_list without values rejected', () => {
    const m = validManifest();
    delete m.tables[1].fields[3].options_list_values;
    assert.ok(!validateManifest(m).valid);
});

t('module calendar flag without config rejected', () => {
    const m = validManifest();
    m.custom_modules[0].settings_override = { grid_calendar_enabled: 1 };
    assert.ok(!validateManifest(m).valid);
});

t('module calendar flag with config passes', () => {
    const m = validManifest();
    m.custom_modules[0].settings_override = {
        grid_calendar_enabled: 1,
        grid_calendar_config: { start_field: 'start_date', end_field: '', title_field: 'employee_name', color_field: '' },
    };
    const r = validateManifest(m);
    assert.ok(r.valid, r.errors.join('; '));
});

t('SQL-injection-shaped table name rejected', () => {
    const m = validManifest();
    m.tables[0].table_name = 'leaves"; DROP TABLE users;--';
    assert.ok(!validateManifest(m).valid);
});

t('settings_override as JSON string accepted', () => {
    const m = validManifest();
    m.custom_modules[0].settings_override = JSON.stringify({ table_view_title: 'X' });
    assert.ok(validateManifest(m).valid);
});

t('DECIMAL without precision warns but passes', () => {
    const m = validManifest();
    m.tables[0].fields.push({ field_name: 'rate', field_type: 'DECIMAL' });
    const r = validateManifest(m);
    assert.ok(r.valid, r.errors.join('; '));
    assert.ok(r.warnings.length >= 1);
});

console.log(`\n${passed} presetSchema tests passed`);
