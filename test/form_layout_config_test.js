// test/form_layout_config_test.js — unit tests for the Form Design & Layout IR helpers.
'use strict';

const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const {
    parseFormLayoutConfig,
    parseFieldRule,
    parseFieldFormSettings,
    parseDependsOn,
    anyFormLayoutEnabled,
} = require('../src/generators/formLayoutConfig');

let passed = 0;
function t(name, fn) {
    try { fn(); passed++; console.log('  ok - ' + name); }
    catch (e) { console.error('  FAIL - ' + name + ': ' + e.message); process.exitCode = 1; }
}

console.log('formLayoutConfig unit tests');

t('no config => null (default form unchanged)', () => {
    assert.strictEqual(parseFormLayoutConfig({}), null);
    assert.strictEqual(parseFormLayoutConfig({ form_layout_config: '' }), null);
    assert.strictEqual(parseFormLayoutConfig({ form_layout_config: 'not json' }), null);
    assert.strictEqual(parseFormLayoutConfig({ form_layout_config: '{"style":"default"}' }), null);
});

t('grouped style parses groups', () => {
    const cfg = parseFormLayoutConfig({
        form_layout_config: JSON.stringify({
            style: 'grouped',
            groups: [
                { key: 'your_info', title: 'Your Info' },
                { key: 'family_info', title: 'Family', collapsible: true, collapsed: true },
            ],
        }),
    });
    assert.ok(cfg);
    assert.strictEqual(cfg.style, 'grouped');
    assert.strictEqual(cfg.groups.length, 2);
    assert.strictEqual(cfg.groups[1].collapsed, true);
});

t('invalid group keys dropped, duplicates dropped', () => {
    const cfg = parseFormLayoutConfig({
        form_layout_config: JSON.stringify({
            style: 'grouped',
            groups: [
                { key: 'ok_key', title: 'A' },
                { key: 'Bad-Key', title: 'B' },
                { key: 'ok_key', title: 'dup' },
                'garbage',
            ],
        }),
    });
    assert.strictEqual(cfg.groups.length, 1);
    assert.strictEqual(cfg.groups[0].key, 'ok_key');
});

t('unknown style normalises to default but keeps columns/groups', () => {
    const cfg = parseFormLayoutConfig({
        form_layout_config: JSON.stringify({ style: 'hologram', columns: 3 }),
    });
    assert.ok(cfg); // columns=3 is a real change
    assert.strictEqual(cfg.style, 'default');
    assert.strictEqual(cfg.columns, 3);
});

t('columns clamped (out-of-range => treated as unset)', () => {
    assert.strictEqual(parseFormLayoutConfig({ form_layout_config: JSON.stringify({ columns: 9 }) }), null);
    const cfg = parseFormLayoutConfig({ form_layout_config: JSON.stringify({ style: 'grouped', columns: 3 }) });
    assert.strictEqual(cfg.columns, 3);
});

t('collapsed only when collapsible', () => {
    const cfg = parseFormLayoutConfig({
        form_layout_config: JSON.stringify({ style: 'accordion', groups: [{ key: 'g1', collapsed: true }] }),
    });
    assert.strictEqual(cfg.groups[0].collapsible, false);
    assert.strictEqual(cfg.groups[0].collapsed, false);
});

t('wizard settings parse', () => {
    const cfg = parseFormLayoutConfig({
        form_layout_config: JSON.stringify({ style: 'wizard', wizard: { start_step: 2, skippable: true } }),
    });
    assert.strictEqual(cfg.wizard.start_step, 2);
    assert.strictEqual(cfg.wizard.skippable, true);
});

t('field rule: equals valid, bad op/field rejected', () => {
    assert.deepStrictEqual(parseFieldRule(JSON.stringify({ field: 'country', op: 'equals', value: 'MY' }), ['equals']), { field: 'country', op: 'equals', value: 'MY' });
    assert.strictEqual(parseFieldRule(JSON.stringify({ field: 'country', op: 'matches', value: 'MY' }), ['equals']), null);
    assert.strictEqual(parseFieldRule(JSON.stringify({ field: '1bad', op: 'equals', value: 'x' }), ['equals']), null);
    assert.strictEqual(parseFieldRule(JSON.stringify({ field: 'f', op: 'equals', value: '' }), ['equals']), null);
    assert.deepStrictEqual(parseFieldRule(JSON.stringify({ field: 'f', op: 'filled' }), ['filled']), { field: 'f', op: 'filled' });
    assert.deepStrictEqual(parseFieldRule(JSON.stringify({ field: 'f', op: 'in', value: ['a', 'b'] }), ['in']), { field: 'f', op: 'in', value: ['a', 'b'] });
    assert.strictEqual(parseFieldRule(JSON.stringify({ field: 'f', op: 'in', value: [] }), ['in']), null);
});

t('field form settings normalise', () => {
    const s = parseFieldFormSettings({
        label_display: 'inline',
        form_group: 'your_info',
        visible_if: JSON.stringify({ field: 'country', op: 'equals', value: 'MY' }),
        required_if_state: 'garbage',
        depends_on: '',
    });
    assert.strictEqual(s.label_display, 'inline');
    assert.strictEqual(s.form_group, 'your_info');
    assert.deepStrictEqual(s.visible_if, { field: 'country', op: 'equals', value: 'MY' });
    assert.strictEqual(s.required_if, null);
    assert.strictEqual(s.depends_on, null);
});

t('depends_on parse + reject', () => {
    assert.deepStrictEqual(parseDependsOn(JSON.stringify({ field: 'country_id', filter_column: 'country_id', count_column: 'available_slots' })),
        { field: 'country_id', filter_column: 'country_id', count_column: 'available_slots' });
    assert.strictEqual(parseDependsOn(JSON.stringify({ field: 'country_id' })), null);
    assert.strictEqual(parseDependsOn('nope'), null);
});

t('anyFormLayoutEnabled', () => {
    assert.strictEqual(anyFormLayoutEnabled({ database: { table: { a: {}, b: {} } } }), false);
    assert.strictEqual(anyFormLayoutEnabled({ database: { table: { a: {}, b: { form_layout_config: '{"style":"wizard"}' } } } }), true);
});

// Store migration smoke test: fresh DB from schema.sql + reopen with ALTERs.
t('store migration: fresh schema has new columns', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixzy-fl-'));
    const dbFile = path.join(tmp, 'test.db');
    const Database = require('better-sqlite3');
    const db = new Database(dbFile);
    db.exec(fs.readFileSync(path.join(__dirname, '..', 'resources', 'schema.sql'), 'utf8'));
    const tCols = db.prepare('PRAGMA table_info(tables)').all().map(c => c.name);
    const fCols = db.prepare('PRAGMA table_info(fields)').all().map(c => c.name);
    assert.ok(tCols.includes('form_layout_config'), 'tables.form_layout_config missing');
    for (const c of ['label_display', 'form_group', 'visible_if', 'required_if_state', 'depends_on']) {
        assert.ok(fCols.includes(c), 'fields.' + c + ' missing');
    }
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
});

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`);
