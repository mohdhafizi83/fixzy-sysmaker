'use strict';
/**
 * MCP server test suite (Fixzy SysMaker).
 *
 * Runs the full MCP stack in-process over InMemoryTransport:
 *   - handshake + tool listing + gating (read-only vs write vs generate)
 *   - resource listing + reading
 *   - full write flow: create project -> add tables/fields -> relationship
 *   - schema validation through the IR gate
 *   - generation into a temp output root (pathGuard enforced)
 *   - security: traversal rejection, unknown tool, disabled tool,
 *     never-exposed deploy/update
 *
 * Usage: node test/mcp_test.js   (exit 0 = PASS)
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
    if (cond) { passed++; console.log(`  PASS  ${name}`); }
    else { failed++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

/** Boot a store + handler registry + MCP server + client for one scenario. */
async function makeSession({ allowWrite = false, allowGenerate = false, dataDir, outputRoots } = {}) {
    const { openStore } = require('../src/core/store');
    fs.mkdirSync(dataDir, { recursive: true });
    const db = openStore(path.join(dataDir, 'Fixzy SysMaker.db'));
    const handlers = new Map();
    const shim = { handle: (n, f) => handlers.set(n, f), on: () => {}, once: () => {} };
    require('../src/handlers/register')({
        ipcMain: shim,
        db,
        getPath: () => dataDir,
        getWindow: () => null,
        dialog: {
            showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
            showMessageBox: async () => ({ response: 0 }),
        },
        shell: { openExternal: async () => {} },
        isPackaged: false,
        enforceOutputRoots: true,
        onQuit: () => {},
    });
    const callHandler = async (name, ...args) => {
        const fn = handlers.get(name);
        if (!fn) throw new Error(`No such handler: ${name}`);
        return fn(null, ...args);
    };
    const { createMcpServer } = require('../src/mcp/server');
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');

    const { server, tools } = await createMcpServer({ db, callHandler, allowWrite, allowGenerate });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st);
    const client = new Client({ name: 'fsm-mcp-test', version: '1.0.0' });
    await client.connect(ct);

    return {
        db,
        client,
        tools,
        async call(name, args = {}) {
            const r = await client.callTool({ name, arguments: args });
            let json = null;
            try { json = JSON.parse(r.content[0].text); } catch { /* error text */ }
            return { err: !!r.isError, text: r.content[0].text, json };
        },
        async close() {
            await client.close();
            await server.close();
            db.close();
        },
    };
}

async function main() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-mcp-test-'));
    const dataDir = path.join(tmp, 'data');
    const outRoot = path.join(tmp, 'out');
    // Tighten output roots to the temp dir so we test the guard, not defaults.
    process.env.FSM_OUTPUT_ROOTS = outRoot;

    try {
        // ── 1. Read-only session ─────────────────────────────────────────
        console.log('\n[1] Read-only gating');
        let s = await makeSession({ dataDir, outputRoots: outRoot });
        let names = (await s.client.listTools()).tools.map((t) => t.name);
        check('read-only exposes 4 read tools', names.length === 4, names.join(','));
        check('read tools present', ['fixzy_capabilities', 'fixzy_list_projects', 'fixzy_get_schema', 'fixzy_validate_schema'].every((n) => names.includes(n)));
        check('write tool hidden when off', !names.includes('fixzy_create_project'));
        check('generate tool hidden when off', !names.includes('fixzy_generate'));
        let r = await s.call('fixzy_create_project', { name: 'Nope' });
        check('disabled write tool rejected', r.err === true);
        r = await s.call('fixzy_capabilities', {});
        check('capabilities readable', !r.err && r.json.database_engines.includes('sqlite'));
        check('capabilities report gating off', r.json.gating.write_enabled === false && r.json.gating.generate_enabled === false);
        check('deploy never in tool list', !names.some((n) => /deploy|update|composer|preview/.test(n) && n !== 'fixzy_update_project_settings'));
        await s.close();

        // ── 2. Write session (no generate) ───────────────────────────────
        console.log('\n[2] Write flow');
        s = await makeSession({ dataDir, allowWrite: true });
        names = (await s.client.listTools()).tools.map((t) => t.name);
        check('write tools visible with allowWrite', names.includes('fixzy_create_project') && names.includes('fixzy_add_table'));
        check('generate still hidden without allowGenerate', !names.includes('fixzy_generate'));

        r = await s.call('fixzy_create_project', { name: 'Library' });
        check('create project', !r.err && r.json.project.app_title === 'Library');
        const pid = r.json.project.project_id;

        r = await s.call('fixzy_add_table', { project: 'Library', table_name: 'books' });
        check('add table books', !r.err && r.json.table.table_name === 'books');
        check('table module_name follows table name', r.json.table.module_name === 'books');

        r = await s.call('fixzy_add_table', { project: 'Library', table_name: 'loans' });
        check('add table loans', !r.err);

        r = await s.call('fixzy_add_table', { project: 'Library', table_name: 'books' });
        check('duplicate table rejected', r.err === true);

        r = await s.call('fixzy_add_table', { project: 'Library', table_name: 'Bad Name!' });
        check('invalid table name rejected', r.err === true);

        r = await s.call('fixzy_add_field', {
            project: pid, table_name: 'books', field_name: 'title',
            data_type: 'VARCHAR', length: 255, required: true,
        });
        check('add field title (bool coerced)', !r.err && r.json.field.required === 1);

        r = await s.call('fixzy_add_field', {
            project: pid, table_name: 'books', field_name: 'bad name', data_type: 'VARCHAR',
        });
        check('invalid field name rejected', r.err === true);

        r = await s.call('fixzy_add_field', {
            project: pid, table_name: 'books', field_name: 'title', data_type: 'VARCHAR',
        });
        check('duplicate field rejected', r.err === true);

        r = await s.call('fixzy_add_field', {
            project: 'Library', table_name: 'loans', field_name: 'book_id', data_type: 'BIGINT', length: 20,
        });
        check('add fk field book_id', !r.err);

        r = await s.call('fixzy_set_relationship', {
            project: 'Library', parent_table: 'books', child_table: 'loans', fk_field: 'book_id',
        });
        check('relationship created', !r.err && r.json.created === true);
        check('relationship parent_field = id', r.json.relationship.parent_field === 'id');

        r = await s.call('fixzy_set_relationship', {
            project: 'Library', parent_table: 'books', child_table: 'loans', fk_field: 'ghost_id',
        });
        check('relationship with missing fk rejected', r.err === true);

        r = await s.call('fixzy_update_project_settings', {
            project: 'Library',
            settings: { theme_config: { mode: 'preset', preset: 'emerald' }, module_realtime: true, bogus_column: 'x' },
        });
        check('settings update ok', !r.err);
        const prow = s.db.prepare('SELECT theme_config, module_realtime FROM projects WHERE project_id = ?').get(pid);
        check('theme_config JSON-encoded', String(prow.theme_config).includes('emerald'));
        check('bool coerced to 1 in DB', prow.module_realtime === 1);

        r = await s.call('fixzy_get_schema', { project: 'Library' });
        check('get_schema returns tables', !r.err && Object.keys(r.json.database.table).length >= 3);
        check('get_schema returns relationships', r.json.database.relationships.length >= 1);

        r = await s.call('fixzy_get_schema', { project: 'NoSuchProject' });
        check('unknown project rejected', r.err === true);

        r = await s.call('fixzy_validate_schema', { project: 'Library' });
        check('validate_schema passes for built project', !r.err && r.json.valid === true,
            r.json && r.json.errors && JSON.stringify(r.json.errors).slice(0, 200));

        r = await s.call('fixzy_generate', { project: 'Library', out: outRoot });
        check('generate hidden without allowGenerate', r.err === true);
        await s.close();

        // ── 3. Generate session ──────────────────────────────────────────
        console.log('\n[3] Generate + pathGuard');
        s = await makeSession({ dataDir, allowWrite: true, allowGenerate: true });
        r = await s.call('fixzy_generate', { project: 'Library', out: outRoot });
        check('generate succeeds inside root', !r.err && r.json.success === true);
        check('generated files > 10', r.json.files > 10, `files=${r.json.files}`);
        check('ir_issues empty for clean schema', Array.isArray(r.json.ir_issues) && r.json.ir_issues.length === 0);
        const genDir = path.join(outRoot, 'library');
        check('target dir exists on disk', fs.existsSync(genDir));
        check('generated app/Models present', fs.existsSync(path.join(genDir, 'app', 'Models')));

        r = await s.call('fixzy_generate', { fixture: 'base_simple', out: path.join(outRoot, 'fx') });
        check('fixture generate works', !r.err && r.json.success === true);

        r = await s.call('fixzy_generate', { fixture: 'no_such_fixture', out: path.join(outRoot, 'fx2') });
        check('unknown fixture rejected', r.err === true);

        r = await s.call('fixzy_generate', { fixture: '../../etc/passwd', out: path.join(outRoot, 'fx3') });
        check('fixture traversal rejected', r.err === true);

        r = await s.call('fixzy_generate', { project: 'Library', out: '/etc' });
        check('outside-root output rejected', r.err === true);

        r = await s.call('fixzy_generate', { out: outRoot });
        check('missing project+fixture rejected', r.err === true);

        r = await s.call('fixzy_generate', { project: 'Library', fixture: 'base_simple', out: outRoot });
        check('both project+fixture rejected', r.err === true);

        // ── 4. Unknown tool + resources ──────────────────────────────────
        console.log('\n[4] Resources + unknown tool');
        r = await s.call('fixzy_not_a_tool', {});
        check('unknown tool rejected', r.err === true);

        const res = await s.client.listResources();
        const uris = res.resources.map((x) => x.uri);
        check('3 resources listed', uris.length === 3, uris.join(','));
        const caps = await s.client.readResource({ uri: 'fixzy://capabilities' });
        check('capabilities resource readable', caps.contents[0].text.includes('Fixzy SysMaker'));
        const ir = await s.client.readResource({ uri: 'fixzy://docs/ir-mapping' });
        check('IR mapping doc readable', ir.contents[0].text.length > 100);
        let resErr = false;
        try { await s.client.readResource({ uri: 'fixzy://etc/passwd' }); } catch { resErr = true; }
        check('unknown resource rejected', resErr);
        await s.close();

        // ── 5. stdout purity (stdio transport) ───────────────────────────
        console.log('\n[5] stdio transport purity (spawned process)');
        const { spawn } = require('child_process');
        const child = spawn(process.execPath, [path.join(ROOT, 'bin', 'fixzy.js'), 'mcp'], {
            env: { ...process.env, FSM_DATA_DIR: dataDir, FSM_OUTPUT_ROOTS: outRoot },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        child.stdout.on('data', (d) => { stdout += d.toString(); });
        const initReq = {
            jsonrpc: '2.0', id: 1, method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'purity-test', version: '1.0.0' },
            },
        };
        child.stdin.write(JSON.stringify(initReq) + '\n');
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');

        const gotResponse = await new Promise((resolve) => {
            const t0 = Date.now();
            const iv = setInterval(() => {
                // stdout must contain ONLY valid JSON-RPC frames, one per line.
                const lines = stdout.split('\n').filter(Boolean);
                if (lines.length >= 2) {
                    clearInterval(iv);
                    resolve(true);
                } else if (Date.now() - t0 > 20000) {
                    clearInterval(iv);
                    resolve(false);
                }
            }, 100);
        });
        child.kill('SIGTERM');
        const frames = stdout.split('\n').filter(Boolean);
        const badLine = frames.find((l) => { try { JSON.parse(l); return false; } catch { return true; } });
        check('stdio: got initialize + tools/list responses', gotResponse);
        check('stdio: every stdout line is valid JSON-RPC (no log pollution)', gotResponse && !badLine,
            badLine ? badLine.slice(0, 80) : undefined);
        const initFrame = JSON.parse(frames[0]);
        check('stdio: server identity correct', initFrame.result && initFrame.result.serverInfo.name === 'fixzy-sysmaker');
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }

    console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'} — ${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
