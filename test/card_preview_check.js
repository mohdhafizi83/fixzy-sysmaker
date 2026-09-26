// test/card_preview_check.js
// Verifies the LIVE card-size preview logic in src/js/handlers/tableHandlers.js
// by extracting the real functions from source and running them against a
// stub DOM. Catches: wrong column counts, missing live-render branch,
// clamping regressions.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'js', 'handlers', 'tableHandlers.js'),
    'utf8'
);

function extractFn(name) {
    const marker = `function ${name}(`;
    const start = src.indexOf(marker);
    assert.ok(start !== -1, `function ${name} not found in tableHandlers.js`);
    let depth = 0, i = src.indexOf('{', start);
    const bodyStart = i;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(start, i + 1);
}

// Stub DOM
let stubElements = {};
global.document = {
    getElementById: (id) => stubElements[id] || null,
    querySelector: (sel) => stubElements['__preview__'] || null,
};

// Load the real functions into this scope
eval(extractFn('buildCardSizePreviewHtml'));
eval(extractFn('buildGridFeaturePreviewHtml'));
eval(extractFn('updateTableViewTemplatePreview'));

function colsOf(html, gridIndex) {
    const m = [...html.matchAll(/grid-template-columns:repeat\((\d+), 1fr\)/g)];
    assert.ok(m.length > gridIndex, `expected >= ${gridIndex + 1} grids in preview html`);
    return parseInt(m[gridIndex][1], 10);
}

let passed = 0;
function check(desc, fn) { fn(); passed++; console.log('  PASS ' + desc); }

// Case 1: defaults 2 tablet / 3 desktop
stubElements = {
    'tbl-tv-template': { value: 'card' },
    'tbl-card-columns-tablet': { value: '2' },
    'tbl-card-columns': { value: '3' },
    '__preview__': { innerHTML: '' },
};
updateTableViewTemplatePreview();
check('live card preview rendered (no <img>)', () => {
    assert.ok(!stubElements['__preview__'].innerHTML.includes('<img'), 'card preview must not use static image');
    assert.ok(stubElements['__preview__'].innerHTML.includes('display:grid'), 'card preview must render grids');
});
check('tablet grid = 2 cols', () => assert.strictEqual(colsOf(stubElements['__preview__'].innerHTML, 0), 2));
check('desktop grid = 3 cols', () => assert.strictEqual(colsOf(stubElements['__preview__'].innerHTML, 1), 3));

// Case 2: 1 tablet / 6 desktop
stubElements['tbl-card-columns-tablet'].value = '1';
stubElements['tbl-card-columns'].value = '6';
updateTableViewTemplatePreview();
check('tablet grid = 1 col', () => assert.strictEqual(colsOf(stubElements['__preview__'].innerHTML, 0), 1));
check('desktop grid = 6 cols', () => assert.strictEqual(colsOf(stubElements['__preview__'].innerHTML, 1), 6));

// Case 3: missing selects -> clamped defaults 2/3
stubElements = {
    'tbl-tv-template': { value: 'card' },
    '__preview__': { innerHTML: '' },
};
updateTableViewTemplatePreview();
check('missing size selects fall back to 2/3', () => {
    assert.strictEqual(colsOf(stubElements['__preview__'].innerHTML, 0), 2);
    assert.strictEqual(colsOf(stubElements['__preview__'].innerHTML, 1), 3);
});

// Case 4: non-card template still uses static image
stubElements = { 'tbl-tv-template': { value: 'left_image' }, '__preview__': { innerHTML: '' } };
updateTableViewTemplatePreview();
check('non-card template uses static image', () => {
    assert.ok(stubElements['__preview__'].innerHTML.includes('left_image.png'));
});

// Case 5: empty selection -> placeholder text
stubElements = { 'tbl-tv-template': { value: '' }, '__preview__': { innerHTML: '' } };
updateTableViewTemplatePreview();
check('empty selection shows placeholder', () => {
    assert.ok(stubElements['__preview__'].innerHTML.includes('Template preview area'));
});

console.log(`card preview checks: ${passed}/8 passed`);
