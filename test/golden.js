// Golden snapshot harness for FiziSysMaker generators.
//
// Usage:
//   node test/golden.js <fixture>            compare generated output vs golden (default)
//   node test/golden.js <fixture> --update   regenerate golden snapshots
//   node test/golden.js                      run ALL fixtures in test/fixtures/
//
// A fixture is a JSON file in test/fixtures/<name>.json shaped like the app's
// full-schema dump (same as test/debug_schema_output.json):
//   { "project": {...}, "database": { "table": {...}, "relationships": {...} } }
//
// Golden trees live in test/golden/<name>/. Any diff fails the run and prints
// unified diffs per file so regressions are visible at a glance.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const GOLDEN_DIR = path.join(__dirname, 'golden');
const TMP_DIR = path.join(__dirname, 'golden_tmp');

// PHP binary: prefer system php (dev machine); bundled bin/ is Windows-only.
function findPhp() {
    try {
        execFileSync('php', ['-v'], { stdio: 'pipe' });
        return 'php';
    } catch (e) {
        return null;
    }
}

function loadFullSchema(fixturePath) {
    const schema = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    return {
        project: schema.project,
        database: {
            name: schema.database.name,
            table: (schema.database && schema.database.table) || {},
            relationships: (schema.database && schema.database.relationships) || [],
            unified_menu: (schema.database && schema.database.unified_menu) || [],
        },
    };
}

// Migration filenames embed a generation timestamp (e.g.
// 2026_09_21_05262301_create_x_table.php). Normalize that prefix to TS__ so
// golden comparison is stable across runs.
const TS_MIGRATION = /^(\d{4}_\d{2}_\d{2}_\d+)(_.+\.php)$/;
function normalizeName(rel) {
    const base = path.basename(rel);
    const m = base.match(TS_MIGRATION);
    if (!m) return rel;
    return path.join(path.dirname(rel), 'TS__' + m[2]);
}

function walk(dir, base = dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, base, out);
        else out.push(normalizeName(path.relative(base, full)));
    }
    return out.sort();
}

// Copy a generated tree to the golden dir with timestamped migration names
// normalized (TS__...).
function copyNormalized(srcDir, destDir) {
    fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(destDir, { recursive: true });
    for (const rel of walk(srcDir)) {
        const src = path.join(srcDir, rel.replace(/^TS__/, ''));
        // walk() returns normalized names; find the real source file:
        const realRel = findRealFile(srcDir, rel);
        const dest = path.join(destDir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(realRel, dest);
    }
}

function findRealFile(rootDir, normalizedRel) {
    // If the normalized name exists directly, use it; else search the dir for a
    // timestamped variant matching the suffix.
    const direct = path.join(rootDir, normalizedRel);
    if (fs.existsSync(direct)) return direct;
    const dir = path.join(rootDir, path.dirname(normalizedRel));
    const suffix = normalizedRel.startsWith('TS__') ? normalizedRel.slice(4) : path.basename(normalizedRel);
    const base = path.basename(normalizedRel);
    if (base.startsWith('TS__')) {
        const tail = base.slice(4);
        for (const f of fs.readdirSync(dir)) {
            if (f.endsWith(tail) && TS_MIGRATION.test(f)) return path.join(dir, f);
        }
    }
    throw new Error(`Cannot locate source file for ${normalizedRel} under ${rootDir}`);
}

function simpleDiff(a, b) {
    // Minimal line diff: report changed/added/removed line numbers (good enough
    // for human review; git diff can be used on the golden vs tmp dirs too).
    const al = a.split('\n'), bl = b.split('\n');
    const lines = [];
    const max = Math.max(al.length, bl.length);
    let shown = 0;
    for (let i = 0; i < max && shown < 20; i++) {
        if (al[i] !== bl[i]) {
            lines.push(`  line ${i + 1}:`);
            if (i < al.length) lines.push(`    - ${al[i]}`);
            if (i < bl.length) lines.push(`    + ${bl[i]}`);
            shown++;
        }
    }
    if (al.length !== bl.length) lines.push(`  (length: golden=${al.length} new=${bl.length})`);
    return lines.join('\n');
}

function generateFixture(fixtureName) {
    const fixturePath = path.join(FIXTURES_DIR, `${fixtureName}.json`);
    if (!fs.existsSync(fixturePath)) {
        throw new Error(`Fixture not found: ${fixturePath}`);
    }
    const fullSchema = loadFullSchema(fixturePath);
    const outDir = path.join(TMP_DIR, fixtureName);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');
    return generateLaravelFilamentStack(fullSchema, outDir).then((res) => {
        if (!res || !res.success) {
            throw new Error(`Generation failed for '${fixtureName}': ${res && res.message}`);
        }
        return outDir;
    });
}

function lintPhp(outDir) {
    const php = findPhp();
    if (!php) {
        console.warn('  [warn] no system php found; skipping php -l lint');
        return { passed: 0, failed: 0 };
    }
    let passed = 0, failed = 0;
    for (const rel of walk(outDir)) {
        if (!rel.endsWith('.php')) continue;
        const real = findRealFile(outDir, rel);
        try {
            execFileSync(php, ['-l', real], { stdio: 'pipe' });
            passed++;
        } catch (e) {
            failed++;
            console.error(`  [php -l FAIL] ${rel}\n${e.stdout || ''}${e.stderr || ''}`);
        }
    }
    return { passed, failed };
}

// Post-generation validation (leftover placeholders/njk, unused imports,
// namespace/path mismatch) on every generated file.
function validateAll(outDir) {
    const { validateGeneratedFile } = require('../src/render/validate');
    let passed = 0, failed = 0;
    for (const rel of walk(outDir)) {
        const real = findRealFile(outDir, rel);
        const res = validateGeneratedFile(real, { basePath: outDir });
        const hard = res.errors.filter((e) => e.severity !== 'warn');
        const soft = res.errors.filter((e) => e.severity === 'warn');
        for (const err of soft) {
            console.warn(`  [validate warn] ${rel}: [${err.rule}] ${err.message}`);
        }
        if (hard.length > 0) {
            failed++;
            for (const err of hard) {
                console.error(`  [validate FAIL] ${rel}: [${err.rule}] ${err.message}`);
            }
        } else {
            passed++;
        }
    }
    return { passed, failed };
}

async function runFixture(fixtureName, update) {
    console.log(`\n=== Fixture: ${fixtureName} ===`);
    const outDir = await generateFixture(fixtureName);
    const files = walk(outDir);
    console.log(`  generated ${files.length} files`);

    const lint = lintPhp(outDir);
    console.log(`  php -l: ${lint.passed} passed, ${lint.failed} failed`);
    if (lint.failed > 0) return false;

    const vres = validateAll(outDir);
    console.log(`  validate: ${vres.passed} passed, ${vres.failed} failed`);
    if (vres.failed > 0) return false;

    const goldenPath = path.join(GOLDEN_DIR, fixtureName);
    if (update || !fs.existsSync(goldenPath)) {
        copyNormalized(outDir, goldenPath);
        console.log(`  golden ${update ? 'UPDATED' : 'CREATED (first run)'} -> ${goldenPath}`);
        return true;
    }

    const goldenFiles = walk(goldenPath);
    const missing = goldenFiles.filter((f) => !files.includes(f));
    const extra = files.filter((f) => !goldenFiles.includes(f));
    let diffs = 0;
    for (const rel of files.filter((f) => goldenFiles.includes(f))) {
        const a = fs.readFileSync(path.join(goldenPath, rel), 'utf8');
        const b = fs.readFileSync(findRealFile(outDir, rel), 'utf8');
        if (a !== b) {
            diffs++;
            console.log(`  [DIFF] ${rel}\n${simpleDiff(a, b)}`);
        }
    }
    if (missing.length) console.log(`  [MISSING vs golden] ${missing.join(', ')}`);
    if (extra.length) console.log(`  [EXTRA vs golden] ${extra.join(', ')}`);

    if (diffs === 0 && missing.length === 0 && extra.length === 0) {
        console.log('  MATCH golden — OK');
        return true;
    }
    return false;
}

async function main() {
    const args = process.argv.slice(2);
    const update = args.includes('--update');
    const names = args.filter((a) => !a.startsWith('--'));

    let fixtures = names;
    if (fixtures.length === 0) {
        if (!fs.existsSync(FIXTURES_DIR)) {
            console.error(`No fixtures dir: ${FIXTURES_DIR}`);
            process.exit(1);
        }
        fixtures = fs.readdirSync(FIXTURES_DIR)
            .filter((f) => f.endsWith('.json'))
            // *_ir.json files are IR-format fixtures exercised by test/ir_test.js,
            // not full-schema dumps — skip them in the golden harness.
            .filter((f) => !f.endsWith('_ir.json'))
            .map((f) => f.replace(/\.json$/, ''));
    }
    if (fixtures.length === 0) {
        console.error('No fixtures found.');
        process.exit(1);
    }

    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TMP_DIR, { recursive: true });

    const results = {};
    for (const name of fixtures) {
        try {
            results[name] = await runFixture(name, update);
        } catch (e) {
            results[name] = false;
            console.error(`  [ERROR] ${e.message}`);
        }
    }

    fs.rmSync(TMP_DIR, { recursive: true, force: true });

    const ok = Object.values(results).filter(Boolean).length;
    console.log(`\n=== SUMMARY: ${ok}/${fixtures.length} fixtures passed ===`);
    for (const [n, pass] of Object.entries(results)) {
        console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}`);
    }
    process.exit(ok === fixtures.length ? 0 : 1);
}

main();
