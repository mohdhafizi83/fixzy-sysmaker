// IR pipeline test (Phase 1.5):
// fixture -> exportIR -> validateIR -> adapter -> generate -> must match golden.
// Proves the IR round-trip is lossless w.r.t. generation output.
//
// Usage: node test/ir_test.js [fixtureName]   (default: base_simple)

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const name = process.argv[2] || 'base_simple';
const fixturePath = path.join(REPO, 'test', 'fixtures', `${name}.json`);
const goldenDir = path.join(REPO, 'test', 'golden', name);
const tmpDir = path.join(REPO, 'test', 'ir_tmp', name);

const { exportIR } = require('../src/ir/exporter');
const { validateIR } = require('../src/ir/validate');
const { asLegacyFullSchema } = require('../src/ir/adapter');

function fail(msg) { console.error(`IR TEST FAIL: ${msg}`); process.exit(1); }

(async () => {
    if (!fs.existsSync(fixturePath)) fail(`fixture not found: ${fixturePath}`);
    if (!fs.existsSync(goldenDir)) fail(`golden not found: ${goldenDir} (run golden harness first)`);

    const dump = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const fullSchema = {
        project: dump.project,
        database: {
            name: dump.database.name,
            table: dump.database.table || {},
            relationships: dump.database.relationships || [],
            unified_menu: dump.database.unified_menu || [],
        },
    };

    // 1. Export + validate IR
    const ir = exportIR(fullSchema);
    const { valid, errors } = validateIR(ir);
    if (!valid) fail(`IR invalid: ${errors.slice(0, 5).map((e) => `${e.path}: ${e.message}`).join(' | ')}`);
    console.log('1. IR export + schema validation: OK');

    // 2. Adapter round-trip must be byte-identical to input fullSchema
    const rt = asLegacyFullSchema(ir);
    if (JSON.stringify(rt) !== JSON.stringify(fullSchema)) {
        fail('adapter round-trip is NOT identical to source fullSchema');
    }
    console.log('2. adapter round-trip identical: OK');

    // 3. Generate through the IR pipeline and compare against golden
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');
    const res = await generateLaravelFilamentStack(asLegacyFullSchema(ir), tmpDir);
    if (!res.success) fail(`generation failed: ${res.message}`);

    // Compare with golden using the same TS__ normalization as golden.js
    const TS_MIGRATION = /^(\d{4}_\d{2}_\d{2}_\d+)(_.+\.php)$/;
    const norm = (rel) => {
        const b = path.basename(rel);
        const m = b.match(TS_MIGRATION);
        return m ? path.join(path.dirname(rel), 'TS__' + m[2]) : rel;
    };
    const walk = (dir, base = dir, out = []) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full, base, out);
            else out.push(norm(path.relative(base, full)));
        }
        return out.sort();
    };
    const findReal = (root, rel) => {
        const direct = path.join(root, rel);
        if (fs.existsSync(direct)) return direct;
        const dir = path.join(root, path.dirname(rel));
        const tail = path.basename(rel).replace(/^TS__/, '');
        for (const f of fs.readdirSync(dir)) {
            if (f.endsWith(tail) && TS_MIGRATION.test(f)) return path.join(dir, f);
        }
        throw new Error(`cannot find ${rel} under ${root}`);
    };

    const goldenFiles = walk(goldenDir);
    const newFiles = walk(tmpDir);
    const missing = goldenFiles.filter((f) => !newFiles.includes(f));
    const extra = newFiles.filter((f) => !goldenFiles.includes(f));
    let diffs = 0;
    for (const rel of newFiles.filter((f) => goldenFiles.includes(f))) {
        const a = fs.readFileSync(path.join(goldenDir, rel), 'utf8');
        const b = fs.readFileSync(findReal(tmpDir, rel), 'utf8');
        if (a !== b) { diffs++; console.error(`  [DIFF] ${rel}`); }
    }
    fs.rmSync(path.join(REPO, 'test', 'ir_tmp'), { recursive: true, force: true });
    if (missing.length || extra.length || diffs) {
        fail(`IR-driven generation differs from golden (diff=${diffs}, missing=${missing.length}, extra=${extra.length})`);
    }
    console.log('3. IR-driven generation matches golden: OK');
    console.log(`\nIR TEST PASS (${name})`);
})().catch((e) => fail(e.stack || e.message));
