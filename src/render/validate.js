// Post-generation validator (Phase 2.2).
//
// Runs over generated files and catches classes of breakage that `php -l`
// alone misses:
//   1. php -l syntax check (PHP files only)
//   2. leftover template artifacts: <<PLACEHOLDER>>, {{ }}, {% %}
//   3. unused `use X\Y;` imports (heuristic: short name never appears again)
//   4. namespace vs file path mismatch (PSR-4: App\ == app/)
//
// Usage:
//   const { validateGeneratedFile, validateGeneratedTree } = require('./validate');
//   const report = validateGeneratedTree(dir, { phpBin });
//   -> { files: [{file, errors:[{rule, message}]}], errorCount }

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function resolvePhpBin(explicit) {
    if (explicit && fs.existsSync(explicit)) return explicit;
    // Prefer system php on Linux/mac; bundled binary is Windows-only today.
    const candidates = ['/usr/bin/php', '/usr/local/bin/php', 'php'];
    for (const c of candidates) {
        try {
            execFileSync(c, ['--version'], { stdio: 'ignore' });
            return c;
        } catch (e) { /* try next */ }
    }
    return null;
}

function stripCommentsAndStrings(content) {
    // Remove PHP comments and string literals so heuristics don't false-positive
    // on words inside strings. Crude but effective for generated code.
    return content
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/^\s*\/\/.*$/gm, ' ')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

function checkPhpLint(filePath, phpBin) {
    if (!phpBin) return null;
    try {
        execFileSync(phpBin, ['-l', filePath], { stdio: 'pipe' });
        return null;
    } catch (e) {
        const msg = (e.stderr ? e.stderr.toString() : e.message).trim().split('\n')[0];
        return { rule: 'php-lint', severity: 'error', message: msg };
    }
}

function checkLeftoverArtifacts(content, filePath) {
    const errors = [];
    const leftoverPlaceholder = content.match(/<<[A-Z0-9_]+>>/g);
    if (leftoverPlaceholder) {
        errors.push({ rule: 'leftover-placeholder', severity: 'error', message: `unreplaced: ${[...new Set(leftoverPlaceholder)].slice(0, 5).join(', ')}` });
    }
    // Nunjucks artifacts ({{ or {%) — but NOT Blade's own {{ }} which is valid
    // Blade. Blade files (.blade.php) legitimately contain {{ }}.
    if (!/\.blade\.php$/.test(filePath)) {
        const njk = content.match(/\{\{[^}]*\}\}|\{%[^%]*%\}/g);
        if (njk) {
            errors.push({ rule: 'leftover-nunjucks', severity: 'error', message: `unrendered: ${[...new Set(njk)].slice(0, 5).join(', ')}` });
        }
    }
    return errors;
}

function checkUnusedImports(content, filePath) {
    if (!/\.php$/.test(filePath) || /\.blade\.php$/.test(filePath)) return [];
    const stripped = stripCommentsAndStrings(content);
    const errors = [];
    const useRe = /^use\s+([A-Za-z0-9_\\]+)(?:\s+as\s+([A-Za-z0-9_]+))?;/gm;
    // Body = content with ALL use-statements removed (fresh regex per replace;
    // reusing the same global regex across exec+replace corrupts lastIndex
    // and caused an infinite loop / OOM).
    const body = stripped.replace(/^use\s+[A-Za-z0-9_\\]+(?:\s+as\s+[A-Za-z0-9_]+)?;/gm, ' ');
    let m;
    while ((m = useRe.exec(stripped)) !== null) {
        const alias = m[2] || m[1].split('\\').pop();
        const re = new RegExp(`\\b${alias}\\b`);
        if (!re.test(body)) {
            errors.push({ rule: 'unused-import', severity: 'warn', message: `use ${m[1]}${m[2] ? ' as ' + m[2] : ''} never referenced` });
        }
    }
    return errors;
}

function checkNamespacePath(filePath, basePath) {
    if (!/\.php$/.test(filePath) || /\.blade\.php$/.test(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const nsMatch = content.match(/^\s*namespace\s+([A-Za-z0-9_\\]+);/m);
    if (!nsMatch) return [];
    const ns = nsMatch[1];
    const rel = path.relative(basePath, filePath);
    const dirPart = path.dirname(rel).split(path.sep).join('\\');
    // PSR-4: namespace should match directory (App\Filament\Pages == app/Filament/Pages, case-insensitive compare of segments with App==app)
    const nsSegs = ns.split('\\');
    const dirSegs = dirPart === '.' ? [] : dirPart.split('\\');
    if (nsSegs.length !== dirSegs.length) {
        return [{ rule: 'namespace-path', severity: 'error', message: `namespace '${ns}' (${nsSegs.length} segs) != dir '${dirPart}' (${dirSegs.length} segs)` }];
    }
    for (let i = 0; i < nsSegs.length; i++) {
        const a = nsSegs[i].toLowerCase();
        const b = dirSegs[i].toLowerCase();
        if (a !== b) {
            return [{ rule: 'namespace-path', severity: 'error', message: `namespace segment '${nsSegs[i]}' != dir segment '${dirSegs[i]}' (path ${dirPart})` }];
        }
    }
    return [];
}

/**
 * Validate one generated file.
 * @param {string} filePath absolute
 * @param {object} opts { basePath, phpBin }
 * @returns {{file: string, errors: Array}}
 */
function validateGeneratedFile(filePath, opts = {}) {
    const content = fs.readFileSync(filePath, 'utf8');
    const errors = [];

    if (/\.php$/.test(filePath)) {
        const lint = checkPhpLint(filePath, opts.phpBin || resolvePhpBin());
        if (lint) errors.push(lint);
    }
    errors.push(...checkLeftoverArtifacts(content, filePath));
    errors.push(...checkUnusedImports(content, filePath));
    if (opts.basePath) errors.push(...checkNamespacePath(filePath, opts.basePath));

    for (const e of errors) if (!e.severity) e.severity = 'error';
    return { file: filePath, errors };
}

function walkFiles(dir, base = dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walkFiles(full, base, out);
        else out.push(full);
    }
    return out;
}

/**
 * Validate a whole generated tree.
 * @returns {{files: Array, errorCount: number, phpBin: string|null}}
 */
function validateGeneratedTree(dir, opts = {}) {
    const phpBin = resolvePhpBin(opts.phpBin);
    const files = walkFiles(dir).filter((f) => /\.(php|blade\.php|md|json)$/.test(f));
    const results = [];
    let errorCount = 0;
    for (const f of files) {
        const r = validateGeneratedFile(f, { basePath: dir, phpBin });
        if (r.errors.length) { results.push(r); errorCount += r.errors.length; }
    }
    return { files: results, errorCount, phpBin };
}

module.exports = { validateGeneratedFile, validateGeneratedTree, resolvePhpBin, stripCommentsAndStrings };

// CLI: node src/render/validate.js <dir>
if (require.main === module) {
    const dir = process.argv[2];
    if (!dir) { console.error('usage: node src/render/validate.js <generated-dir>'); process.exit(2); }
    const rep = validateGeneratedTree(dir);
    if (rep.errorCount === 0) { console.log(`VALID: ${rep.files.length === 0 ? 'no issues' : ''} (php: ${rep.phpBin})`); process.exit(0); }
    console.error(`INVALID: ${rep.errorCount} issue(s) in ${rep.files.length} file(s)`);
    for (const f of rep.files) {
        console.error(`  ${f.file}`);
        for (const e of f.errors) console.error(`    [${e.rule}] ${e.message}`);
    }
    process.exit(1);
}
