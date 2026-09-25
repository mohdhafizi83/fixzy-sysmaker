/**
 * Phase 5.4 — path allowlist guard tests (TDD).
 * Run: node test/pathguard_test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateOutputPath, getRootsFromEnv, isInside } = require('../src/core/pathGuard');

let passed = 0;
function t(name, fn) {
    try {
        fn();
        passed++;
        console.log('  PASS ' + name);
    } catch (e) {
        console.error('  FAIL ' + name + ': ' + e.message);
        process.exitCode = 1;
    }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-guard-'));
const roots = [path.join(tmp, 'projects'), tmp];

console.log('pathGuard tests');

t('allowed path inside root', () => {
    const r = validateOutputPath(path.join(tmp, 'projects', 'myapp'), { roots });
    assert.ok(r.ok, 'should allow: ' + r.reason);
});

t('root itself allowed', () => {
    const r = validateOutputPath(path.join(tmp, 'projects'), { roots });
    assert.ok(r.ok);
});

t('outside root rejected', () => {
    const r = validateOutputPath('/etc/evil', { roots });
    assert.ok(!r.ok && /outside allowed roots/.test(r.reason));
});

t('lexical .. rejected before resolution', () => {
    // Build the raw string WITHOUT path.join so the .. survives to the guard.
    const raw = tmp + '/projects/../../etc/evil';
    const r = validateOutputPath(raw, { roots });
    assert.ok(!r.ok, 'traversal must be rejected, got: ' + JSON.stringify(r));
    assert.ok(/traversal/.test(r.reason));
});

t('symlink escape rejected', () => {
    const projDir = path.join(tmp, 'projects');
    fs.mkdirSync(projDir, { recursive: true });
    const linkDir = path.join(projDir, 'escape');
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-outside-'));
    let madeLink = false;
    try {
        fs.symlinkSync(outside, linkDir);
        madeLink = true;
        const r = validateOutputPath(path.join(linkDir, 'app'), { roots });
        assert.ok(!r.ok, 'symlink escape must be blocked');
        assert.ok(/symlink escape/.test(r.reason));
    } catch (e) {
        // Windows without Developer Mode/admin cannot create symlinks
        // (EPERM/ENOSYS). The guard logic is platform-independent;
        // skip rather than false-fail the suite.
        if (process.platform === 'win32' && (e.code === 'EPERM' || e.code === 'ENOSYS' || e.code === 'EINVAL')) {
            console.log('  SKIP symlink escape rejected (symlinks need Windows dev mode)');
            passed--; // don't count as a pass either way
            return;
        }
        throw e;
    } finally {
        if (madeLink) fs.rmSync(linkDir, { force: true });
        fs.rmSync(outside, { recursive: true, force: true });
    }
});

t('missing parent inside root allowed (will be created)', () => {
    const r = validateOutputPath(path.join(tmp, 'projects', 'brand-new', 'deeper'), { roots });
    assert.ok(r.ok, 'should allow non-existent inside root: ' + r.reason);
});

t('empty path rejected', () => {
    assert.ok(!validateOutputPath('', { roots }).ok);
    assert.ok(!validateOutputPath('   ', { roots }).ok);
    assert.ok(!validateOutputPath(null, { roots }).ok);
});

t('FSM_OUTPUT_ROOTS env parsed (colon + comma)', () => {
    const r1 = getRootsFromEnv({ FSM_OUTPUT_ROOTS: '/a:/b' });
    assert.deepStrictEqual(r1, ['/a', '/b']);
    const r2 = getRootsFromEnv({ FSM_OUTPUT_ROOTS: '/x,/y' });
    assert.deepStrictEqual(r2, ['/x', '/y']);
    const r3 = getRootsFromEnv({});
    assert.deepStrictEqual(r3, [path.join(os.homedir(), 'projects'), os.homedir()]);
});

t('~ expansion in env roots', () => {
    const r = getRootsFromEnv({ FSM_OUTPUT_ROOTS: '~/work' });
    assert.deepStrictEqual(r, [path.join(os.homedir(), 'work')]);
});

t('isInside component-wise (no /home/fizi vs /home/fizi2 false positive)', () => {
    assert.ok(!isInside('/home/fizi2/app', '/home/fizi'));
    assert.ok(isInside('/home/fizi/app', '/home/fizi'));
    assert.ok(isInside('/home/fizi', '/home/fizi'));
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} pathGuard tests passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
