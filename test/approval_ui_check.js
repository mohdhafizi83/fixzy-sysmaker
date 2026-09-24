// test/approval_ui_check.js
// Verifies the real validation/slug logic from src/js/features/approvalManager.js
// by bundling it with esbuild and exercising the exported functions.
// Catches: validation regressions, slug collisions, preset integrity.

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const tmp = '/tmp/approval_ui_bundle.js';
execSync(
    `npx esbuild ${path.join(__dirname, '..', 'src', 'js', 'features', 'approvalManager.js')} ` +
    `--bundle --format=cjs --outfile=${tmp} --external:electron`,
    { cwd: path.join(__dirname, '..'), stdio: 'pipe' }
);

// Stub browser globals before requiring (module top-level only defines, no DOM touch).
global.document = { getElementById: () => null, querySelectorAll: () => [] };
const mod = require(tmp);
const { validateConfig, slugify, PRESETS } = mod;

let pass = 0, fail = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('PASS ' + name); }
    catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); }
}

check('slugify basic', () => {
    assert.strictEqual(slugify('In Review', []), 'in_review');
});
check('slugify dedupe', () => {
    assert.strictEqual(slugify('Pending', ['pending']), 'pending_2');
});
check('slugify leading digit', () => {
    assert.match(slugify('2nd stage', []), /^[a-z]/);
});
check('validate: missing statusField rejected', () => {
    const errs = validateConfig({ statusField: '', initial: 'a', statuses: [{ key: 'a' }, { key: 'b' }], transitions: [{ from: 'a', to: 'b' }] });
    assert.ok(errs.some(e => /status field/i.test(e)));
});
check('validate: <2 statuses rejected', () => {
    const errs = validateConfig({ statusField: 's', initial: 'a', statuses: [{ key: 'a' }], transitions: [] });
    assert.ok(errs.length >= 1);
});
check('validate: all-final rejected', () => {
    const errs = validateConfig({ statusField: 's', initial: 'a', statuses: [{ key: 'a', final: true }, { key: 'b', final: true }], transitions: [{ from: 'a', to: 'b' }] });
    assert.ok(errs.some(e => /not be final/i.test(e)));
});
check('validate: transition from final rejected', () => {
    const errs = validateConfig({
        statusField: 's', initial: 'a',
        statuses: [{ key: 'a' }, { key: 'b', final: true }],
        transitions: [{ from: 'b', to: 'a' }],
    });
    assert.ok(errs.some(e => /final status/i.test(e)));
});
check('validate: self-transition rejected', () => {
    const errs = validateConfig({ statusField: 's', initial: 'a', statuses: [{ key: 'a' }, { key: 'b' }], transitions: [{ from: 'a', to: 'a' }] });
    assert.ok(errs.some(e => /itself/i.test(e)));
});
check('validate: unknown status ref rejected', () => {
    const errs = validateConfig({ statusField: 's', initial: 'a', statuses: [{ key: 'a' }, { key: 'b' }], transitions: [{ from: 'a', to: 'ghost' }] });
    assert.ok(errs.some(e => /missing status/i.test(e)));
});
check('validate: happy path passes', () => {
    const errs = validateConfig({
        statusField: 'status', initial: 'draft',
        statuses: [{ key: 'draft' }, { key: 'approved', final: true }],
        transitions: [{ from: 'draft', to: 'approved' }],
    });
    assert.deepStrictEqual(errs, []);
});
check('presets all valid', () => {
    for (const [name, p] of Object.entries(PRESETS)) {
        const errs = validateConfig({ statusField: 'status', initial: p.statuses[0].key, statuses: p.statuses, transitions: p.transitions });
        assert.deepStrictEqual(errs, [], `preset ${name} invalid: ${errs.join('; ')}`);
    }
});
check('presets: every preset has >=1 final and >=1 non-final', () => {
    for (const [name, p] of Object.entries(PRESETS)) {
        assert.ok(p.statuses.some(s => s.final), name + ' has no final');
        assert.ok(p.statuses.some(s => !s.final), name + ' all final');
    }
});

fs.unlinkSync(tmp);
console.log(`\n=== approval UI check: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
