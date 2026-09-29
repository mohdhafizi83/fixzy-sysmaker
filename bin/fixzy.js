#!/usr/bin/env node
/**
 * fixzy CLI (Phase 5.2)
 *
 * Commands:
 *   serve [--port 7788] [--host 127.0.0.1]   Web UI + IPC-over-HTTP
 *   generate --project <name|id> --out <dir>  Headless generate (no Electron)
 *   fixtures                                  Run golden fixture tests
 *   list                                      List projects in the store
 *   mcp [--allow-write] [--allow-generate]    MCP server on stdio (AI agents)
 */
'use strict';

const path = require('path');
const fs = require('fs');

/** Parse argv into {key:value} flags plus positional args under `_`. @param {string[]} argv argument tokens @returns {object} parsed flags, positionals in args._ */
function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) { args[key] = next; i++; }
            else args[key] = true;
        } else {
            args._.push(a);
        }
    }
    return args;
}

/** Print CLI usage/help text to stdout. @returns {void} */
function usage() {
    console.log(`fixzy — Fixzy SysMaker CLI (multi-stack admin system generator)

Usage:
  fixzy serve [--port 7788] [--host 127.0.0.1]
  fixzy generate --project <name-or-id> --out <dir> [--zip]
  fixzy generate --fixture <name> --out <dir> [--zip]
  fixzy list
  fixzy fixtures
  fixzy mcp [--allow-write] [--allow-generate]

MCP mode:
  Speaks the Model Context Protocol over stdio (JSON-RPC) so AI hosts
  (Claude Desktop, Cursor, ...) can inspect and build Fixzy SysMaker
  projects. Read-only by default; add --allow-write (or FSM_MCP_ALLOW_WRITE=1)
  for schema mutation tools and --allow-generate (or FSM_MCP_ALLOW_GENERATE=1)
  for the generate tool. Deploy/update are never exposed.

Env:
  FSM_DATA_DIR       store directory (default ~/.fixzy)
  FSM_OUTPUT_ROOTS   allowed output roots (default: ~/projects:$HOME)
  FSM_ALLOW_REMOTE=1 required to bind non-localhost
  FSM_MCP_ALLOW_WRITE=1 / FSM_MCP_ALLOW_GENERATE=1  MCP tool gating
`);
}

/** Open the Fixzy SysMaker store via core/store (FSM_DATA_DIR honored). @returns {import('better-sqlite3').Database} */
function openDb() {
    const { openStore } = require('../src/core/store');
    return openStore();
}

/** `fixzy list` — print all projects (id, title, stack, active flag). @returns {void} */
function cmdList() {
    const db = openDb();
    const rows = db.prepare('SELECT project_id, app_title, stack_base, is_active FROM projects ORDER BY project_id').all();
    if (rows.length === 0) {
        console.log('No projects in store (' + db.name + ').');
    } else {
        for (const r of rows) {
            console.log(`${r.project_id}\t${r.app_title}\t${r.stack_base}${r.is_active ? '\t[active]' : ''}`);
        }
    }
    db.close();
}

/**
 * `fixzy generate` — headless generation from a stored project or fixture.
 * Validates the output path against the allowlist, assembles the full schema
 * (via the IPC handler registry or fixture JSON), runs the IR gate, then
 * generates the Laravel+Filament stack.
 * @param {object} args parsed CLI args (--project|--fixture, --out, --zip)
 * @returns {Promise<void>}
 */
async function cmdGenerate(args) {
    const { validateOutputPath } = require('../src/core/pathGuard');
    const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');

    if (!args.out) {
        console.error('generate requires --out <dir>');
        process.exit(2);
    }
    // Guard the RAW argument first (before resolve() erases `..`), then
    // re-check the resolved form.
    const guardRaw = validateOutputPath(String(args.out));
    if (!guardRaw.ok) {
        console.error(`Output path rejected: ${guardRaw.reason}`);
        process.exit(2);
    }
    const outDir = path.resolve(String(args.out));
    const guard = validateOutputPath(outDir);
    if (!guard.ok) {
        console.error(`Output path rejected: ${guard.reason}`);
        process.exit(2);
    }

    let fullSchema = null;
    let projectName = null;

    if (args.fixture) {
        // Headless fixture mode: fixture JSON IS the full schema shape.
        const fixturePath = path.isAbsolute(args.fixture)
            ? args.fixture
            : path.join(__dirname, '..', 'test', 'fixtures', args.fixture.replace(/\.json$/, '') + '.json');
        if (!fs.existsSync(fixturePath)) {
            console.error(`Fixture not found: ${fixturePath}`);
            process.exit(1);
        }
        fullSchema = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
        projectName = fullSchema.project.app_title || path.basename(fixturePath, '.json');
    } else {
        if (!args.project) {
            console.error('generate requires --project <name-or-id> (or --fixture <name>)');
            process.exit(2);
        }
        const db = openDb();
        let project = null;
        if (/^\d+$/.test(String(args.project))) {
            project = db.prepare('SELECT * FROM projects WHERE project_id = ?').get(Number(args.project));
        }
        if (!project) {
            project = db.prepare('SELECT * FROM projects WHERE app_title = ?').get(String(args.project));
        }
        if (!project) {
            console.error(`Project not found: ${args.project}`);
            process.exit(1);
        }
        // Reuse the exact schema assembly the GUI uses, via the handler registry.
        const handlers = new Map();
        const shim = {
            handle: (name, fn) => handlers.set(name, fn),
            on: () => {},
            once: () => {},
        };
        const registerIpcHandlers = require('../src/handlers/register');
        registerIpcHandlers({
            ipcMain: shim,
            db,
            getPath: () => path.join(require('os').homedir(), '.fixzy'),
            getWindow: () => null,
            dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }), showMessageBox: async () => ({ response: 0 }) },
            shell: { openExternal: async () => {} },
            isPackaged: false,
            enforceOutputRoots: true,
            onQuit: () => {},
        });
        fullSchema = await handlers.get('project:get-full-schema')(null, project.project_id);
        projectName = project.app_title;
        db.close();
    }

    if (!fullSchema) {
        console.error('Failed to load full schema.');
        process.exit(1);
    }

    // IR validation gate (mirrors GUI behaviour)
    try {
        const { exportIR } = require('../src/ir/exporter');
        const { validateIR } = require('../src/ir/validate');
        const { valid, errors } = validateIR(exportIR(fullSchema));
        if (!valid) console.warn(`[IR] ${errors.length} validation issue(s) (non-fatal)`);
    } catch (e) {
        console.warn('[IR] validation skipped:', e.message);
    }

    const target = path.join(guard.resolved, String(projectName).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase());
    fs.mkdirSync(target, { recursive: true });
    console.log(`Generating "${projectName}" -> ${target}`);
    const result = await generateLaravelFilamentStack(fullSchema, target);
    if (!result.success) {
        console.error('Generation failed:', result.message);
        process.exit(1);
    }
    console.log('Generated OK:', target);

    if (args.zip) {
        const zipPath = target + '.zip';
        const { execFileSync } = require('child_process');
        execFileSync('zip', ['-qr', zipPath, path.basename(target)], { cwd: path.dirname(target) });
        console.log('Zip export:', zipPath);
    }
}

/**
 * `fixzy serve` — start the web UI + IPC-over-HTTP server.
 * Refuses non-localhost binds unless FSM_ALLOW_REMOTE=1 (no auth in v1).
 * @param {object} args parsed CLI args (--port, --host)
 * @returns {Promise<void>}
 */
async function cmdServe(args) {
    const host = args.host || '127.0.0.1';
    if (host !== '127.0.0.1' && host !== 'localhost' && process.env.FSM_ALLOW_REMOTE !== '1') {
        console.error('Refusing to bind non-localhost without FSM_ALLOW_REMOTE=1.');
        console.error('No auth in v1 — see docs/NATIVE_FEATURES.md (LAN-only / reverse proxy).');
        process.exit(2);
    }
    const { createWebServer } = require('../src/core/webServer');
    const { server } = createWebServer({ host, port: Number(args.port || 7788) });
    server.listen(Number(args.port || 7788), host, () => {
        console.log(`Fixzy SysMaker web UI: http://${host}:${args.port || 7788}`);
        if (host !== '127.0.0.1' && host !== 'localhost') {
            console.warn('*** REMOTE BIND ACTIVE — no authentication. LAN or reverse-proxy only. ***');
        }
    });
}

/** `fixzy fixtures` — run the golden fixture test suite, exit with its status. @returns {void} */
function cmdFixtures() {
    const { spawnSync } = require('child_process');
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'test', 'golden.js')], { stdio: 'inherit' });
    process.exit(r.status || 0);
}

/**
 * `fixzy mcp` — start the MCP server on stdio for AI agent hosts.
 * Read-only unless --allow-write / --allow-generate (or env flags) are set.
 * @param {object} args parsed CLI args (--allow-write, --allow-generate)
 * @returns {Promise<void>}
 */
async function cmdMcp(args) {
    const { startStdioMcp } = require('../src/mcp/server');
    await startStdioMcp({
        allowWrite: args['allow-write'] === true || process.env.FSM_MCP_ALLOW_WRITE === '1',
        allowGenerate: args['allow-generate'] === true || process.env.FSM_MCP_ALLOW_GENERATE === '1',
    });
    // Keep the process alive; the transport owns stdin.
}

(async () => {
    const args = parseArgs(process.argv.slice(2));
    const cmd = args._[0];
    try {
        if (cmd === 'serve') return await cmdServe(args);
        if (cmd === 'generate') return await cmdGenerate(args);
        if (cmd === 'list') return cmdList();
        if (cmd === 'fixtures') return cmdFixtures();
        if (cmd === 'mcp') return await cmdMcp(args);
        usage();
        process.exit(cmd ? 1 : 0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
})();
