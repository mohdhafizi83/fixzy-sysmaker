/**
 * Path allowlist guard (Phase 5.4 — security-critical).
 *
 * All generated output destinations must resolve INSIDE one of the allowed
 * roots. Guards against:
 *  - `..` traversal (lexical, before resolution)
 *  - symlink escape (realpath of nearest existing ancestor)
 *  - absolute paths outside roots
 *
 * Roots come from FSM_OUTPUT_ROOTS (colon/comma separated) or defaults:
 * ~/projects and $HOME.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function getDefaultRoots() {
    const home = os.homedir();
    return [path.join(home, 'projects'), home];
}

function getRootsFromEnv(env) {
    const raw = (env && env.FSM_OUTPUT_ROOTS) || '';
    if (!raw.trim()) return getDefaultRoots();
    return raw
        .split(/[:,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => path.resolve(s.replace(/^~(?=$|\/|\\)/, os.homedir())));
}

/** True if `resolved` is `root` itself or inside it (component-wise). */
function isInside(resolved, root) {
    const rel = path.relative(root, resolved);
    return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

/**
 * Validate a destination path against the allowlist.
 * @param {string} dest  requested destination (may not exist yet)
 * @param {object} opts  { roots?: string[], env?: object }
 * @returns {{ ok: boolean, resolved?: string, reason?: string }}
 */
function validateOutputPath(dest, opts = {}) {
    if (typeof dest !== 'string' || dest.trim() === '') {
        return { ok: false, reason: 'empty path' };
    }

    // 1. Reject lexical traversal on the RAW input before any resolution
    //    (path.normalize() would silently erase resolvable `..`).
    if (dest.split(/[/\\]/).includes('..')) {
        return { ok: false, reason: 'path traversal (..) not allowed' };
    }

    const roots = (opts.roots || getRootsFromEnv(opts.env || process.env)).map((r) => path.resolve(r));

    // 2. Lexical containment check on the requested absolute path.
    const abs = path.resolve(dest);
    if (!roots.some((r) => isInside(abs, r))) {
        return { ok: false, reason: `outside allowed roots: ${roots.join(', ')}` };
    }

    // 3. Symlink escape check: walk up to nearest existing ancestor,
    //    realpath it, then re-append the non-existing tail.
    let resolved;
    try {
        resolved = fs.realpathSync(abs);
    } catch {
        const missingTail = [];
        let cur = abs;
        while (true) {
            try {
                const real = fs.realpathSync(cur);
                resolved = path.join(real, ...missingTail);
                break;
            } catch {
                missingTail.unshift(path.basename(cur));
                const parent = path.dirname(cur);
                if (parent === cur) { resolved = abs; break; }
                cur = parent;
            }
        }
    }

    if (!roots.some((r) => isInside(resolved, r))) {
        return { ok: false, reason: `symlink escape blocked: resolves to ${resolved}` };
    }

    return { ok: true, resolved };
}

module.exports = { validateOutputPath, getRootsFromEnv, getDefaultRoots, isInside };
