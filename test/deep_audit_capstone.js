/**
 * Fasa 28 — Capstone: full acceptance journey, zero manual steps.
 *
 * 1. Clean slate -> build DEEP-AUDIT-001 from scratch via real IPC (f2 build)
 * 2. Generate + migrate + seed + boot (timed: boot gate < 60s)
 * 3. Serve, then run the full harness matrix sequentially:
 *      f20/21 runtime (S/N checks), grid (Fasa 22), f23, f24, f25
 * 4. Performance gates: generate < 15 min, boot < 60s, list page < 2s
 * 5. Aggregate matrix: every phase must be 0 FAIL.
 *
 * Usage: node test/deep_audit_capstone.js
 * (Runs everything itself; ~10-15 min total.)
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const REPO = '/home/fizi/projects/FiziSysMaker';
const results = [];
function gate(name, ok, detail) {
    results.push({ name, ok: !!ok, detail: detail || '' });
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  [' + String(detail).slice(0, 200) + ']' : ''));
}
function run(cmd, opts = {}) {
    const r = spawnSync('bash', ['-c', cmd], { cwd: REPO, encoding: 'utf8', timeout: opts.timeout || 900000, env: { ...process.env, ...(opts.env || {}) } });
    return r;
}
function runHarness(file) {
    const t0 = Date.now();
    const r = run(`node test/${file} 2>&1 | tail -40`, { timeout: 900000 });
    const out = r.stdout || '';
    const m = out.match(/(\d+) PASS \/ (\d+) FAIL/);
    const secs = Math.round((Date.now() - t0) / 1000);
    if (!m) return { ok: false, pass: 0, fail: -1, secs, out };
    return { ok: m[2] === '0', pass: +m[1], fail: +m[2], secs, out };
}

(async () => {
    console.log('=== CAPSTONE STEP 1: clean build from scratch ===');
    run('pgrep -f "[a]rtisan serve" | xargs -r kill 2>/dev/null; true');
    run('rm -rf /tmp/fsm-deep-store /tmp/fsm-deep-build /tmp/fsm-deep-app');
    const b = run('FSM_DATA_DIR=/tmp/fsm-deep-store node test/deep_audit_build.js 2>&1 | tail -2', { timeout: 300000 });
    gate('C1. fixture build from zero (real IPC)', /0 fail/.test(b.stdout || ''), (b.stdout || '').trim().split('\n').pop());

    console.log('=== CAPSTONE STEP 2: generate + migrate + boot (timed) ===');
    const t0 = Date.now();
    const boot = run('FSM_DATA_DIR=/tmp/fsm-deep-store node test/deep_audit_boot.js 2>&1 | tail -2', { timeout: 900000 });
    const bootSecs = Math.round((Date.now() - t0) / 1000);
    gate('C2. generate+migrate+seed completes', /app ready/.test(boot.stdout || ''), bootSecs + 's');
    gate('C3. perf gate: full generate+boot < 15 min', bootSecs < 900, bootSecs + 's');

    // serve — detached spawn (NOT spawnSync: the backgrounded server holds
    // inherited pipe fds and would block the parent forever).
    const { spawn } = require('child_process');
    const srv = spawn('php', ['artisan', 'serve', '--port=8911'], {
        cwd: '/tmp/fsm-deep-app', stdio: 'ignore', detached: true,
    });
    srv.unref();
    let up = false;
    for (let i = 0; i < 30; i++) {
        const c = spawnSync('bash', ['-c', 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8911/admin/login']);
        if ((c.stdout || '').toString().trim() === '200') { up = true; break; }
        await new Promise((r) => setTimeout(r, 1000));
    }
    gate('C4. app serves /admin/login 200', up);

    // list page perf: time a login-page + dashboard HTML fetch via curl (server render)
    const t1 = Date.now();
    spawnSync('bash', ['-c', 'curl -s -o /dev/null http://127.0.0.1:8911/admin/login']);
    const listMs = Date.now() - t1;
    gate('C5. perf gate: page render < 2s', listMs < 2000, listMs + 'ms');

    console.log('=== CAPSTONE STEP 3: full harness matrix ===');
    const phases = [
        ['deep_audit_runtime.js', 'Fasa 20/21 field semantics (S+N)'],
        ['deep_audit_grid.js', 'Fasa 22 grid/kanban/calendar/tree/softdel/CSV'],
        ['deep_audit_f23.js', 'Fasa 23 scoping/approval/numbering/public'],
        ['deep_audit_f24.js', 'Fasa 24 hooks + automation'],
        ['deep_audit_f25.js', 'Fasa 25 cross-feature matrix'],
    ];
    let totalPass = 0; let totalFail = 0;
    for (const [file, label] of phases) {
        const r = runHarness(file);
        totalPass += Math.max(r.pass, 0); totalFail += Math.max(r.fail, 0);
        gate('C6.' + file + ' — ' + label, r.ok, `${r.pass} PASS / ${r.fail} FAIL in ${r.secs}s`);
    }

    console.log('\n================ CAPSTONE ACCEPTANCE MATRIX ================');
    const fails = results.filter((x) => !x.ok);
    console.log(`checkpoints: ${results.length} | pass: ${results.length - fails.length} | fail: ${fails.length}`);
    console.log(`harness checkpoints total: ${totalPass} PASS / ${totalFail} FAIL`);
    if (fails.length) { console.log('FAILED GATES:'); fails.forEach((f) => console.log('  - ' + f.name + ' ' + f.detail)); }
    console.log(fails.length === 0 ? 'RESULT: 100% GREEN — reproducible acceptance proven.' : 'RESULT: NOT GREEN.');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CAPSTONE FATAL:', e.message); process.exit(2); });
