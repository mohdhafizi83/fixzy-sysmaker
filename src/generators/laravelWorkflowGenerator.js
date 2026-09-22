// Workflow/hooks codegen (BUG-015).
//
// Compiles the stored workflow JSON ({ blocks, connections }) from
// project_hook_workflow / table_hook_workflow into native Laravel code:
//
//   * table hooks  -> App\Observers\{Model}WorkflowObserver.php
//   * project hooks -> App\Listeners\ProjectWorkflowListener.php
//   * both         -> App\Providers\WorkflowServiceProvider.php
//
// v1 supported block vocabulary:
//   triggers : before_insert/after_insert/before_update/after_update/
//              before_delete/after_delete (table), on_startup/after_login/
//              before_logout/on_login_failure/after_user_created/
//              before_user_deleted/on_scheduled_task (project)
//   actions  : insert_record, update_record, delete_record, variable,
//              terminate_workflow, try_catch, comment
//   logic    : condition (flat comparison/logical expression)
// Anything else compiles to an explicit `// [fixzy] ... not supported in v1`
// comment so generated PHP always stays valid and gaps stay visible.

const fs = require('fs');
const path = require('path');
const pluralize = require('pluralize');

const IDENT = /^[a-z_][a-z0-9_]*$/i;

function safeIdent(name, kind) {
    if (typeof name === 'string' && IDENT.test(name)) return name;
    throw new Error(`unsafe ${kind}: ${JSON.stringify(name)}`);
}

function phpString(v) {
    return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

// Compile one logic-builder value item to a PHP expression.
// Returns null when the item type is not supported in v1.
function compileValue(item) {
    if (!item || typeof item !== 'object') return null;
    switch (item.type) {
        case 'string':
            return phpString(item.value ?? '');
        case 'number': {
            const n = Number(item.value);
            return Number.isFinite(n) ? String(n) : null;
        }
        case 'boolean':
            return String(item.value === true || item.value === 'true' || item.value === '1');
        case 'null':
            return 'null';
        case 'current_user':
            return 'auth()->user()';
        case 'current_datetime':
            return 'now()';
        case 'this_record_data':
            return `$record->${safeIdent(item.field, 'field')}`;
        default:
            return null;
    }
}

const CMP_OPS = { '==': '==', '!=': '!=', '>': '>', '<': '<', '>=': '>=', '<=': '<=', 'eq': '==', 'neq': '!=', 'gt': '>', 'lt': '<', 'gte': '>=', 'lte': '<=' };
const LOGIC_OPS = { and: '&&', or: '||' };

// Compile a flat condition token list (value op value [logicop ...]) to a PHP
// boolean expression. Returns null if unsupported.
function compileCondition(tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0) return null;
    const parts = [];
    let expectValue = true;
    for (const t of tokens) {
        if (!t || typeof t !== 'object') return null;
        if (t.type === 'comment') continue;
        if (expectValue) {
            const v = compileValue(t);
            if (v === null) return null;
            parts.push(v);
            expectValue = false;
        } else if (t.type === 'comparison_operator') {
            const op = CMP_OPS[String(t.value)];
            if (!op) return null;
            parts.push(op);
            expectValue = true;
        } else if (t.type === 'logical_operator') {
            const op = LOGIC_OPS[String(t.value)];
            if (!op) return null;
            parts.push(op);
            expectValue = true;
        } else if (t.type === 'open_paren') {
            parts.push('(');
            expectValue = true;
        } else if (t.type === 'close_paren') {
            parts.push(')');
            expectValue = false;
        } else {
            return null;
        }
    }
    if (expectValue) return null; // ended on an operator
    return parts.join(' ');
}

// Compile a WHERE clause ({logic:'and'|'or', rules:[{field,operator,value}]})
// into a chain of ->where(...) calls on $query.
function compileWhere(where, indent) {
    const rules = (where && Array.isArray(where.rules)) ? where.rules : [];
    if (rules.length === 0) return null;
    const joiner = String(where.logic || 'and').toLowerCase() === 'or' ? 'orWhere' : 'where';
    const lines = rules.map((r) => {
        const field = safeIdent(r.field, 'where field');
        const op = String(r.operator || '=');
        const allowed = ['=', '!=', '>', '<', '>=', '<=', 'like', 'not like'];
        if (!allowed.includes(op.toLowerCase())) {
            return `${indent}->where(${phpString(field)}, 'unsupported:${op}')`;
        }
        const val = compileValue(r.value) ?? phpString(r.value ?? '');
        return `${indent}->where(${phpString(field)}, ${phpString(op)}, ${val})`;
    });
    return lines.join('\n');
}

// Compile one action block's configData (flat token list) into PHP statements.
// Returns { code, unsupported } where code is an array of lines.
function compileAction(block, recordVar) {
    const lines = [];
    let tokens = [];
    try {
        tokens = JSON.parse(block.configData || '[]');
    } catch (e) {
        tokens = [];
    }
    if (!Array.isArray(tokens)) tokens = [];

    const pushUnsupported = (why) =>
        lines.push(`// [fixzy] ${why} — not supported in v1, skipped.`);

    switch (block.type) {
        case 'insert_record': {
            if (!block.table) { pushUnsupported('insert_record without target table'); break; }
            const table = safeIdent(block.table, 'table');
            const details = block.details || {};
            const values = Array.isArray(details.values) ? details.values : [];
            if (values.length === 0) { pushUnsupported('insert_record with no field values'); break; }
            const arr = values.map((p) => {
                const f = safeIdent(p.field, 'insert field');
                const v = compileValue(p.value) ?? phpString(p.value ?? '');
                return `${phpString(f)} => ${v}`;
            });
            lines.push(`\\DB::table(${phpString(table)})->insert([`);
            arr.forEach((a) => lines.push(`    ${a},`));
            lines.push(']);');
            break;
        }
        case 'update_record': {
            if (!block.table) { pushUnsupported('update_record without target table'); break; }
            const table = safeIdent(block.table, 'table');
            const details = block.details || {};
            const set = Array.isArray(details.set) ? details.set : [];
            if (set.length === 0) { pushUnsupported('update_record with no SET values'); break; }
            const setArr = set.map((p) => {
                const f = safeIdent(p.field, 'update field');
                const v = compileValue(p.value) ?? phpString(p.value ?? '');
                return `${phpString(f)} => ${v}`;
            });
            lines.push(`\\DB::table(${phpString(table)})`);
            const whereChain = details.where ? compileWhere(details.where, '    ') : null;
            if (whereChain) {
                lines.push(whereChain);
            } else {
                pushUnsupported('update_record without WHERE — refusing unbounded update');
                break;
            }
            lines.push(`    ->update([`);
            setArr.forEach((a) => lines.push(`        ${a},`));
            lines.push('    ]);');
            break;
        }
        case 'delete_record': {
            if (!block.table) { pushUnsupported('delete_record without target table'); break; }
            const table = safeIdent(block.table, 'table');
            const details = block.details || {};
            lines.push(`\\DB::table(${phpString(table)})`);
            const whereChain = details.where ? compileWhere(details.where, '    ') : null;
            if (whereChain) {
                lines.push(whereChain);
            } else {
                pushUnsupported('delete_record without WHERE — refusing unbounded delete');
                break;
            }
            lines.push('    ->delete();');
            break;
        }
        case 'variable': {
            const name = block.variableName ? safeIdent(block.variableName, 'variable name') : null;
            if (!name) { pushUnsupported('variable without a name'); break; }
            const expr = compileCondition(tokens); // reuse: single value works too
            if (expr === null) { pushUnsupported('variable expression'); break; }
            lines.push(`$${name} = ${expr};`);
            break;
        }
        case 'terminate_workflow':
            lines.push('return;');
            break;
        case 'comment': {
            const text = tokens.length === 1 && tokens[0].type === 'comment'
                ? String(tokens[0].value || '')
                : String(block.configData || '');
            text.split('\n').forEach((l) => lines.push(`// ${l}`));
            break;
        }
        default:
            pushUnsupported(`block type '${block.type}'`);
    }
    return lines;
}

// Walk the block graph starting from a block id, emitting PHP statements.
// condition blocks branch on out-true / out-false connections.
function walkChain(ctx, startId, indentStr, visited) {
    const lines = [];
    let cur = startId;
    while (cur && !visited.has(cur)) {
        visited.add(cur);
        const block = ctx.blocks[cur];
        if (!block) break;

        if (block.type === 'condition') {
            let tokens = [];
            try { tokens = JSON.parse(block.configData || '[]'); } catch (e) { tokens = []; }
            const expr = compileCondition(tokens);
            if (expr === null) {
                lines.push(`${indentStr}// [fixzy] condition not compilable in v1 — branch skipped.`);
                break;
            }
            const trueNext = ctx.nextOf(cur, 'out-true');
            const falseNext = ctx.nextOf(cur, 'out-false');
            lines.push(`${indentStr}if (${expr}) {`);
            lines.push(...walkChain(ctx, trueNext, indentStr + '    ', visited));
            lines.push(`${indentStr}} else {`);
            lines.push(...walkChain(ctx, falseNext, indentStr + '    ', visited));
            lines.push(`${indentStr}}`);
            break; // branches own the rest of the flow
        }

        if (block.type === 'try_catch') {
            const bodyNext = ctx.nextOf(cur, 'out');
            lines.push(`${indentStr}try {`);
            lines.push(...walkChain(ctx, bodyNext, indentStr + '    ', visited));
            lines.push(`${indentStr}} catch (\\Throwable $e) {`);
            lines.push(`${indentStr}    // [fixzy] workflow error swallowed by try/catch block.`);
            lines.push(`${indentStr}}`);
            break;
        }

        lines.push(...compileAction(block).map((l) => (l.startsWith('//') ? indentStr + l : indentStr + l)));
        cur = ctx.nextOf(cur, 'out');
    }
    return lines;
}

function buildCtx(blocks, connections) {
    const nextMap = new Map(); // `${blockId}:${point}` -> toBlock
    for (const c of connections || []) {
        const key = `${c.fromBlock}:${c.fromPoint}`;
        if (!nextMap.has(key)) nextMap.set(key, c.toBlock);
    }
    return {
        blocks,
        nextOf: (id, point) => nextMap.get(`${id}:${point}`) || null,
    };
}

function findTriggers(blocks) {
    return Object.entries(blocks || {}).filter(([, b]) => b.type === 'hook_trigger' && b.hook_type);
}

function modelClassName(tableName, tables) {
    if (tableName === 'users') return 'User';
    const t = (tables || {})[tableName];
    const src = (t && t.module_name && t.module_name.trim() !== '') ? t.module_name.trim() : tableName;
    const singular = pluralize.singular(src);
    return singular
        .split(/[_\s-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
}

const TABLE_EVENT = {
    before_insert: 'creating',
    after_insert: 'created',
    before_update: 'updating',
    after_update: 'updated',
    before_delete: 'deleting',
    after_delete: 'deleted',
};

const PROJECT_EVENT = {
    after_login: ['Illuminate\\Auth\\Events\\Login::class', '$event->user'],
    before_logout: ['Illuminate\\Auth\\Events\\Logout::class', '$event->user'],
    on_login_failure: ['Illuminate\\Auth\\Events\\Failed::class', '$event->user'],
    // Model-level events use Laravel's generic eloquent.* event names so the
    // hook fires on actual User model lifecycle, not registration only.
    after_user_created: ["'eloquent.created: App\\Models\\User'", '$event'],
    before_user_deleted: ["'eloquent.deleting: App\\Models\\User'", '$event'],
};

function compileWorkflowBody(blocks, connections, recordVar) {
    const ctx = buildCtx(blocks, connections);
    const triggers = findTriggers(blocks);
    const out = [];
    for (const [tid] of triggers) {
        const start = ctx.nextOf(tid, 'out');
        out.push(...walkChain(ctx, start, '        ', new Set([tid])));
    }
    return out;
}

// ---------- file builders ----------

function buildObserverPhp(modelClass, tableName, methods) {
    const parts = [];
    parts.push('<?php');
    parts.push('');
    parts.push('namespace App\\Observers;');
    parts.push('');
    parts.push(`use App\\Models\\${modelClass};`);
    parts.push('');
    parts.push('/**');
    parts.push(` * Workflow observer for ${tableName} (Fixzy SysMaker generated).`);
    parts.push(' * Methods are emitted from the table workflow graph; empty bodies');
    parts.push(' * mean the connected blocks were not codegen-supported in v1.');
    parts.push(' */');
    parts.push(`class ${modelClass}WorkflowObserver`);
    parts.push('{');
    methods.forEach((m, i) => {
        if (i > 0) parts.push('');
        parts.push(`    public function ${m.name}(${modelClass} $record): void`);
        parts.push('    {');
        if (m.body.length === 0) {
            parts.push('        // No codegen-supported actions connected to this hook.');
        } else {
            parts.push(...m.body);
        }
        parts.push('    }');
    });
    parts.push('}');
    parts.push('');
    return parts.join('\n');
}

function buildListenerPhp(projectHooks) {
    const parts = [];
    parts.push('<?php');
    parts.push('');
    parts.push('namespace App\\Listeners;');
    parts.push('');
    parts.push('/**');
    parts.push(' * Project-level workflow listener (Fixzy SysMaker generated).');
    parts.push(' */');
    parts.push('class ProjectWorkflowListener');
    parts.push('{');
    let first = true;
    for (const h of projectHooks) {
        if (!first) parts.push('');
        first = false;
        parts.push(`    public function ${h.method}(${h.typeHint}$event): void`);
        parts.push('    {');
        if (h.body.length === 0) {
            parts.push('        // No codegen-supported actions connected to this hook.');
        } else {
            // Alias so compiled `this_record_data` ($record) resolves against
            // either an auth event (->user) or a model event (the model itself).
            parts.push('        $record = $event->user ?? $event;');
            parts.push(...h.body);
        }
        parts.push('    }');
    }
    parts.push('}');
    parts.push('');
    return parts.join('\n');
}

function buildProviderPhp(tableObservers, projectHooks, hasScheduled) {
    const parts = [];
    parts.push('<?php');
    parts.push('');
    parts.push('namespace App\\Providers;');
    parts.push('');
    parts.push('use Illuminate\\Support\\ServiceProvider;');
    parts.push('use Illuminate\\Support\\Facades\\Event;');
    parts.push('use Illuminate\\Support\\Facades\\Schedule;');
    parts.push('');
    parts.push('/**');
    parts.push(' * Registers Fixzy SysMaker generated workflow hooks.');
    parts.push(' */');
    parts.push('class WorkflowServiceProvider extends ServiceProvider');
    parts.push('{');
    parts.push('    public function boot(): void');
    parts.push('    {');
    if (tableObservers.length === 0 && projectHooks.length === 0 && !hasScheduled) {
        parts.push('        // No workflows configured.');
    }
    tableObservers.forEach((o) => {
        parts.push(`        \\App\\Models\\${o.modelClass}::observe(\\App\\Observers\\${o.observerClass}::class);`);
    });
    projectHooks.forEach((h) => {
        parts.push(`        Event::listen(${h.eventClass}, \\App\\Listeners\\ProjectWorkflowListener::class . '@${h.method}');`);
    });
    if (hasScheduled) {
        parts.push("        Schedule::command('fixzy:scheduled-workflow')->everyMinute();");
    }
    parts.push('    }');
    parts.push('}');
    parts.push('');
    return parts.join('\n');
}

function buildScheduledCommandPhp(body) {
    const parts = [];
    parts.push('<?php');
    parts.push('');
    parts.push('namespace App\\Console\\Commands;');
    parts.push('');
    parts.push('use Illuminate\\Console\\Command;');
    parts.push('');
    parts.push('class ScheduledWorkflowCommand extends Command');
    parts.push('{');
    parts.push("    protected $signature = 'fixzy:scheduled-workflow';");
    parts.push('');
    parts.push("    protected $description = 'Run the Fixzy SysMaker scheduled workflow (on_scheduled_task hook)';");
    parts.push('');
    parts.push('    public function handle(): int');
    parts.push('    {');
    if (body.length === 0) {
        parts.push('        // No codegen-supported actions connected to the scheduled hook.');
    } else {
        parts.push(...body.map((l) => l.replace(/^ {8}/, '        ')));
    }
    parts.push('');
    parts.push('        return self::SUCCESS;');
    parts.push('    }');
    parts.push('}');
    parts.push('');
    return parts.join('\n');
}

/**
 * Generate workflow hook code for the whole project.
 * @param {Object} fullSchema { project, database: { table } }
 * @param {string} outputDir
 */
async function generateWorkflowHooks(fullSchema, outputDir) {
    try {
        const project = fullSchema.project || {};
        const tables = (fullSchema.database && fullSchema.database.table) || {};

        const parse = (raw) => {
            if (!raw || typeof raw !== 'string' || raw.trim() === '' || raw === 'null') return null;
            try {
                const j = JSON.parse(raw);
                if (j && typeof j === 'object' && j.blocks && Object.keys(j.blocks).length > 0) return j;
            } catch (e) { /* ignore */ }
            return null;
        };

        // ---- table hooks -> observers ----
        const tableObservers = [];
        for (const [tableName, t] of Object.entries(tables)) {
            const wf = parse(t.table_hook_workflow);
            if (!wf) continue;
            const triggers = findTriggers(wf.blocks);
            if (triggers.length === 0) continue;
            const modelClass = modelClassName(tableName, tables);
            const methods = [];
            for (const [tid, tb] of triggers) {
                const eventName = TABLE_EVENT[tb.hook_type];
                if (!eventName) continue;
                const ctx = buildCtx(wf.blocks, wf.connections);
                const body = walkChain(ctx, ctx.nextOf(tid, 'out'), '        ', new Set([tid]));
                methods.push({ name: eventName, body });
            }
            if (methods.length === 0) continue;
            const observersDir = path.join(outputDir, 'app', 'Observers');
            fs.mkdirSync(observersDir, { recursive: true });
            const observerClass = `${modelClass}WorkflowObserver`;
            fs.writeFileSync(
                path.join(observersDir, `${observerClass}.php`),
                buildObserverPhp(modelClass, tableName, methods)
            );
            tableObservers.push({ modelClass, observerClass });
        }

        // ---- project hooks ----
        const projectWf = parse(project.project_hook_workflow);
        const projectHooks = [];
        let scheduledBody = null;
        if (projectWf) {
            const triggers = findTriggers(projectWf.blocks);
            for (const [tid, tb] of triggers) {
                const ctx = buildCtx(projectWf.blocks, wfConnectionsSafe(projectWf));
                const body = walkChain(ctx, ctx.nextOf(tid, 'out'), '        ', new Set([tid]));
                if (tb.hook_type === 'on_scheduled_task') {
                    scheduledBody = body;
                    continue;
                }
                const mapping = PROJECT_EVENT[tb.hook_type];
                if (!mapping) continue;
                const method = tb.hook_type.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
                projectHooks.push({
                    method,
                    eventClass: mapping[0],
                    typeHint: '',
                    body,
                });
            }
        }
        function wfConnectionsSafe(wf) { return wf.connections || []; }

        const hasScheduled = scheduledBody !== null;
        if (hasScheduled) {
            const cmdDir = path.join(outputDir, 'app', 'Console', 'Commands');
            fs.mkdirSync(cmdDir, { recursive: true });
            fs.writeFileSync(
                path.join(cmdDir, 'ScheduledWorkflowCommand.php'),
                buildScheduledCommandPhp(scheduledBody)
            );
        }

        if (tableObservers.length === 0 && projectHooks.length === 0 && !hasScheduled) {
            return { success: true, message: 'No workflows configured; nothing generated.' };
        }

        if (projectHooks.length > 0) {
            const listenersDir = path.join(outputDir, 'app', 'Listeners');
            fs.mkdirSync(listenersDir, { recursive: true });
            fs.writeFileSync(
                path.join(listenersDir, 'ProjectWorkflowListener.php'),
                buildListenerPhp(projectHooks)
            );
        }

        const providersDir = path.join(outputDir, 'app', 'Providers');
        fs.mkdirSync(providersDir, { recursive: true });
        fs.writeFileSync(
            path.join(providersDir, 'WorkflowServiceProvider.php'),
            buildProviderPhp(tableObservers, projectHooks, hasScheduled)
        );

        // Register in bootstrap/providers.php when generating into a full app.
        const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
        if (fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            if (!contents.includes('WorkflowServiceProvider')) {
                contents = contents.replace(
                    /return\s*\[/,
                    'return [\n    App\\Providers\\WorkflowServiceProvider::class,'
                );
                fs.writeFileSync(providersFile, contents);
            }
        }

        return {
            success: true,
            message: `Workflow hooks: ${tableObservers.length} observer(s), ${projectHooks.length} project listener(s)${hasScheduled ? ', 1 scheduled command' : ''}.`,
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = { generateWorkflowHooks, compileCondition, compileValue, modelClassName };
