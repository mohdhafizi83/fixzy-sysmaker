// Branch-level template coverage probe (7.7a).
//
// Which {% if %} / {% else %} / {% for %} BRANCH DIRECTIONS inside every .njk
// template are actually exercised across all golden fixtures — not just which
// templates render at all (that's test/template_coverage.js).
//
// How it works:
//   1. Copies the template tree to test/bcov_tmp/templates/ with inline
//      instrumentation: after every {% if %} tag inserts
//      {{ __bc('<rel>', <line>, 'true') }}, after {% else %} a 'false' hit,
//      after {% elseif %} an 'elseif' hit, inside {% for %} bodies an 'iter'
//      hit. Insertions are inline (no newlines) so line numbers are preserved.
//      Source templates are NEVER modified.
//   2. Builds a second nunjucks Environment over the instrumented copy with
//      the same options + filters as src/render/engine.
//   3. Patches engine.renderTemplate (before generators load) to render via
//      the instrumented env with a Proxy-wrapped context exposing __bc.
//   4. Runs every fixture through generateLaravelFilamentStack and reports
//      per-branch hit counts + NEVER-taken directions.
//
// Safety preconditions (verified 2026-09-27, re-checked at runtime):
//   - no branch tags inside {% raw %} blocks
//   - no multiline if conditions
// If either is violated the harness aborts rather than mis-instrument.
//
// Usage:
//   node test/branch_coverage.js            all fixtures
//   node test/branch_coverage.js fx1 fx2    specific fixtures (names or paths)
//   node test/branch_coverage.js --selftest sabotage check (no fixtures)
//
// Exit code 1 on any fixture crash or selftest failure. NEVER-taken branches
// are REPORTED, not failed — gap closure is a manual planning step (Fasa C).

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const nunjucks = require('nunjucks');

const engine = require('../src/render/engine');
const { asLegacyFullSchema } = require('../src/ir/adapter');

const TPL_ROOT = engine.TEMPLATE_ROOT;
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TMP_DIR = path.join(__dirname, 'bcov_tmp');

// ---------------------------------------------------------------------------
// 1. Instrumentation
// ---------------------------------------------------------------------------

// Scan a template into a flat, ordered list of control tags with nesting.
// Returns { tags: [{kind, line, start, end, depth, openIdx}], problems: [] }
// kind: 'if' | 'elseif' | 'else' | 'endif' | 'for' | 'endfor' | 'raw'
const TAG_RE = /\{%-?\s*(if|elseif|else|endif|for|endfor|raw|endraw)\b[\s\S]*?%?\}/g;

function scanTags(src) {
    const problems = [];
    const tags = [];
    // First: raw regions, so we can skip tags inside them.
    const rawRegions = [];
    const rawRe = /\{%-?\s*raw\s*-?%\}[\s\S]*?\{%-?\s*endraw\s*-?%\}/g;
    let m;
    while ((m = rawRe.exec(src)) !== null) rawRegions.push([m.index, m.index + m[0].length]);
    const inRaw = (idx) => rawRegions.some(([a, b]) => idx > a && idx < b);

    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(src)) !== null) {
        if (inRaw(m.index)) continue;
        const kind = m[1];
        const text = m[0];
        // Multiline condition check: a tag containing a newline before its
        // closing delimiter is unsupported by this harness.
        if (text.includes('\n')) {
            problems.push(`multiline tag: ${kind} at line ${src.slice(0, m.index).split('\n').length}`);
            continue;
        }
        tags.push({
            kind,
            line: src.slice(0, m.index).split('\n').length,
            start: m.index,
            end: m.index + text.length,
        });
    }
    return { tags, problems };
}

// Insert hit-recorder calls; returns instrumented source.
function instrument(src, rel) {
    const { tags, problems } = scanTags(src);
    if (problems.length) return { out: null, problems };

    // Nesting: match if->else/elseif->endif and for->endfor.
    const stack = [];
    const inserts = []; // {pos, text}
    for (const t of tags) {
        if (t.kind === 'if') {
            inserts.push({ pos: t.end, text: `{{ __bc(${JSON.stringify(rel)}, ${t.line}, 'true') }}` });
            stack.push(t);
        } else if (t.kind === 'elseif') {
            inserts.push({ pos: t.end, text: `{{ __bc(${JSON.stringify(rel)}, ${t.line}, 'elseif') }}` });
        } else if (t.kind === 'else') {
            inserts.push({ pos: t.end, text: `{{ __bc(${JSON.stringify(rel)}, ${t.line}, 'false') }}` });
        } else if (t.kind === 'endif') {
            if (!stack.length) return { out: null, problems: [`unmatched endif at line ${t.line}`] };
            stack.pop();
        } else if (t.kind === 'for') {
            inserts.push({ pos: t.end, text: `{{ __bc(${JSON.stringify(rel)}, ${t.line}, 'iter') }}` });
            stack.push(t);
        } else if (t.kind === 'endfor') {
            if (!stack.length) return { out: null, problems: [`unmatched endfor at line ${t.line}`] };
            stack.pop();
        }
    }
    if (stack.length) return { out: null, problems: [`unclosed block: ${stack[stack.length - 1].kind} at line ${stack[stack.length - 1].line}`] };

    // Apply inserts back-to-front so offsets stay valid.
    inserts.sort((a, b) => b.pos - a.pos);
    let out = src;
    for (const ins of inserts) {
        out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos);
    }
    return { out, problems: [] };
}

function listTemplates(dir, base = dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) listTemplates(full, base, out);
        else if (e.name.endsWith('.njk')) out.push(path.relative(base, full).split(path.sep).join('/'));
    }
    return out.sort();
}

// ---------------------------------------------------------------------------
// 2. Build instrumented tree + env
// ---------------------------------------------------------------------------

function buildInstrumentedTree() {
    const tplDir = path.join(TMP_DIR, 'templates');
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(tplDir, { recursive: true });
    const allProblems = [];
    for (const rel of listTemplates(TPL_ROOT)) {
        const src = fs.readFileSync(path.join(TPL_ROOT, rel), 'utf8');
        const { out, problems } = instrument(src, rel);
        if (problems.length) {
            allProblems.push(...problems.map((p) => `${rel}: ${p}`));
            continue;
        }
        const dest = path.join(tplDir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, out);
    }
    if (allProblems.length) {
        console.error('INSTRUMENTATION ABORTED — unsupported constructs:');
        for (const p of allProblems) console.error('  ' + p);
        process.exit(1);
    }
    return tplDir;
}

function buildEnv(tplDir) {
    const env2 = new nunjucks.Environment(
        new nunjucks.FileSystemLoader(tplDir, { watch: false, noCache: false }),
        { autoescape: false, trimBlocks: false, lstripBlocks: false, throwOnUndefined: true }
    );
    for (const [name, fn] of Object.entries(engine.env.filters)) env2.addFilter(name, fn);
    return env2;
}

// ---------------------------------------------------------------------------
// 3. Hit recorder + engine patch
// ---------------------------------------------------------------------------

// hits: Map "rel:line:dir" -> Set(fixtureName)
const hits = new Map();
let currentFixture = '?';

function recordHit(rel, line, dir) {
    const key = `${rel}:${line}:${dir}`;
    if (!hits.has(key)) hits.set(key, new Set());
    hits.get(key).add(currentFixture);
    return '';
}

function wrapCtx(ctx) {
    // nunjucks enumerates context keys when building frames, so a Proxy
    // get-trap alone is invisible — inject __bc as a real property.
    const c = ctx || {};
    try {
        Object.defineProperty(c, '__bc', {
            value: recordHit, enumerable: true, configurable: true, writable: true,
        });
    } catch (e) {
        // Frozen context: shallow-copy so we can attach the recorder.
        const copy = Object.assign({}, c);
        Object.defineProperty(copy, '__bc', {
            value: recordHit, enumerable: true, configurable: true, writable: true,
        });
        return copy;
    }
    return c;
}

const origRender = engine.renderTemplate;
engine.renderTemplate = function (name, ctx) {
    return bcovEnv.render(String(name), wrapCtx(ctx));
};
let bcovEnv = null;

// ---------------------------------------------------------------------------
// 4. Fixture runner (mirrors template_coverage.js)
// ---------------------------------------------------------------------------

function loadFullSchema(schema) {
    if (schema && schema.ir_version) return asLegacyFullSchema(schema);
    return {
        project: schema.project,
        database: {
            name: schema.database.name,
            table: (schema.database && schema.database.table) || {},
            relationships: (schema.database && schema.database.relationships) || [],
            unified_menu: (schema.database && schema.database.unified_menu) || [],
            widgets: (schema.database && schema.database.widgets) || [],
        },
    };
}

async function runFixture(fxPath) {
    const schema = JSON.parse(fs.readFileSync(fxPath, 'utf8'));
    const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');
    const outDir = path.join(TMP_DIR, 'out', path.basename(fxPath, '.json'));
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const res = await generateLaravelFilamentStack(loadFullSchema(schema), outDir);
    if (!res || !res.success) throw new Error(res && res.message);
}

// ---------------------------------------------------------------------------
// 5. Report
// ---------------------------------------------------------------------------

// Expected directions per template: derived from the ORIGINAL source tags.
function expectedDirections() {
    const expected = []; // {rel, line, kind, dir}
    for (const rel of listTemplates(TPL_ROOT)) {
        const src = fs.readFileSync(path.join(TPL_ROOT, rel), 'utf8');
        const { tags } = scanTags(src);
        for (const t of tags) {
            if (t.kind === 'if') expected.push({ rel, line: t.line, dir: 'true' });
            else if (t.kind === 'elseif') expected.push({ rel, line: t.line, dir: 'elseif' });
            else if (t.kind === 'else') expected.push({ rel, line: t.line, dir: 'false' });
            else if (t.kind === 'for') expected.push({ rel, line: t.line, dir: 'iter' });
        }
    }
    return expected;
}

function report() {
    const expected = expectedDirections();
    const covered = expected.filter((e) => hits.has(`${e.rel}:${e.line}:${e.dir}`));
    const gaps = expected.filter((e) => !hits.has(`${e.rel}:${e.line}:${e.dir}`));

    console.log('\n=== BRANCH COVERAGE ===');
    console.log(`branch directions: ${expected.length} | covered: ${covered.length} | never-taken: ${gaps.length}\n`);

    let lastRel = null;
    for (const g of gaps.sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line)) {
        if (g.rel !== lastRel) { console.log(`\n${g.rel}`); lastRel = g.rel; }
        console.log(`  line ${g.line}: ${g.dir} NEVER TAKEN`);
    }
    if (!gaps.length) console.log('All branch directions exercised.');
    return gaps;
}

// ---------------------------------------------------------------------------
// 6. Selftest (sabotage check): a synthetic template must record both
//    directions when forced, and the harness must see them.
// ---------------------------------------------------------------------------

function selftest() {
    const tplDir = path.join(TMP_DIR, 'selftest');
    fs.mkdirSync(tplDir, { recursive: true });
    const src = 'A{% if flag %}T{% else %}F{% endif %}B{% for x in items %}[{{ x }}]{% endfor %}';
    const { out, problems } = instrument(src, 'selftest.njk');
    if (problems.length) { console.error('selftest instrument failed:', problems); return false; }
    fs.writeFileSync(path.join(tplDir, 'selftest.njk'), out);
    const env2 = buildEnv(tplDir);
    hits.clear();

    currentFixture = 'force-true';
    env2.render('selftest.njk', wrapCtx({ flag: true, items: [1] }));
    currentFixture = 'force-false';
    env2.render('selftest.njk', wrapCtx({ flag: false, items: [] }));

    const okTrue = (hits.get('selftest.njk:1:true') || new Set()).has('force-true');
    const okFalse = (hits.get('selftest.njk:1:false') || new Set()).has('force-false');
    const okIter = (hits.get('selftest.njk:1:iter') || new Set()).has('force-true');
    const noIter = !(hits.get('selftest.njk:1:iter') || new Set()).has('force-false');
    const rendered = env2.render('selftest.njk', wrapCtx({ flag: true, items: [7] }));
    const contentOk = rendered === 'ATB[7]';

    console.log('SELFTEST: true-hit=' + okTrue + ' false-hit=' + okFalse +
        ' iter-hit=' + okIter + ' iter-empty-not-counted=' + noIter + ' content-preserved=' + contentOk);
    return okTrue && okFalse && okIter && noIter && contentOk;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

(async () => {
    const args = process.argv.slice(2);
    if (args.includes('--selftest')) {
        process.exitCode = selftest() ? 0 : 1;
        fs.rmSync(TMP_DIR, { recursive: true, force: true });
        return;
    }

    bcovEnv = buildEnv(buildInstrumentedTree());

    let fixtures;
    if (args.length) {
        fixtures = args.map((a) => (a.endsWith('.json') ? a : path.join(FIXTURES_DIR, a + '.json')));
    } else {
        fixtures = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json')).sort()
            .map((f) => path.join(FIXTURES_DIR, f));
    }

    let failed = 0;
    for (const fx of fixtures) {
        currentFixture = path.basename(fx, '.json');
        try {
            await runFixture(fx);
        } catch (e) {
            console.error(`[FAIL] ${currentFixture}: ${e.message}`);
            failed++;
        }
    }
    const gaps = report();
    console.log(`\nfixtures: ${fixtures.length} | crashed: ${failed} | branch gaps: ${gaps.length}`);
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    if (failed) process.exitCode = 1;
})();
