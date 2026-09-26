// test/preset_ui_check.js
// Guards the Starter Packs UI contract:
//  1. The mandatory "not a complete business system" disclaimer exists in
//     the preview modal and is NOT hidden by default.
//  2. All required DOM ids exist (picker grid, modal, install button).
//  3. Every bundled preset manifest validates and carries the fields the
//     picker renders (name, tagline, category).
//  4. presetManager.js bundles cleanly with esbuild (no syntax/import
//     errors that would silently kill the renderer feature).
'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { validateManifest } = require('../src/core/presetSchema');
const { loadBundledPresets, presetSummary } = require('../src/core/presetInstaller');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('PASS ' + name); }
    catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); }
}

check('disclaimer present in preview modal', () => {
    const m = html.match(/id="preset-disclaimer"[^>]*>([\s\S]*?)<\/p>/);
    assert.ok(m, 'preset-disclaimer element missing');
    const text = m[1].replace(/\s+/g, ' ').trim();
    assert.ok(/NOT complete, ready-to-run business systems/.test(text), 'disclaimer text missing/changed: ' + text.slice(0, 120));
    assert.ok(/can be edited/.test(text), 'disclaimer must state editability');
});

check('disclaimer is not hidden', () => {
    const m = html.match(/<p id="preset-disclaimer"[^>]*>/);
    assert.ok(m, 'preset-disclaimer element missing');
    assert.ok(!/class="[^"]*hidden/.test(m[0]), 'disclaimer must not carry the hidden class');
});

check('required DOM ids exist', () => {
    ['starter-packs-grid', 'preset-preview-modal', 'preset-preview-title', 'preset-preview-tagline',
     'preset-preview-caveats', 'preset-preview-conflicts', 'preset-preview-tables',
     'preset-preview-modules', 'preset-install-btn'].forEach((id) => {
        assert.ok(html.includes(`id="${id}"`), `missing element id: ${id}`);
    });
});

check('all bundled presets validate + render fields', () => {
    const packs = loadBundledPresets(path.join(ROOT, 'src', 'presets'));
    assert.ok(packs.length >= 5, 'expected at least 5 bundled presets, got ' + packs.length);
    packs.forEach(({ manifest, file }) => {
        const r = validateManifest(manifest);
        assert.ok(r.valid, `${file}: ${r.errors.join('; ')}`);
        const s = presetSummary(manifest);
        assert.ok(s.name && s.tagline && s.category, `${file}: missing picker fields`);
        assert.ok(Array.isArray(s.tables) && s.tables.length > 0, `${file}: no tables in summary`);
    });
});

check('money/time packs carry caveats', () => {
    const packs = loadBundledPresets(path.join(ROOT, 'src', 'presets'));
    packs.forEach(({ manifest, file }) => {
        const blob = JSON.stringify(manifest).toLowerCase();
        const touchesMoney = /estimated_value|price|amount|cost|billing|invoice/.test(blob);
        const touchesSlots = /booking|reservation|slot/.test(blob);
        if (touchesMoney || touchesSlots) {
            assert.ok((manifest.caveats || []).length > 0,
                `${file}: touches money/slots but has no caveats`);
        }
    });
});

check('presetManager bundles cleanly', () => {
    const tmp = '/tmp/preset_manager_bundle.js';
    execSync(
        `npx esbuild ${path.join(ROOT, 'src', 'js', 'features', 'presetManager.js')} ` +
        `--bundle --format=cjs --outfile=${tmp} --external:electron`,
        { cwd: ROOT, stdio: 'pipe' }
    );
    const src = fs.readFileSync(tmp, 'utf8');
    assert.ok(src.includes('initStarterPacks'), 'initStarterPacks export lost in bundle');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
