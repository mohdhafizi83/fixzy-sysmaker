// Workflow/hooks codegen (BUG-015).
//
// Compiles the stored workflow JSON ({ blocks, connections }) from
// project_hook_workflow / table_hook_workflow into native Laravel code:
//
//   * table hooks  -> App\Observers\{Model}WorkflowObserver.php
//   * project hooks -> App\Listeners\ProjectWorkflowListener.php
//   * both         -> App\Providers\WorkflowServiceProvider.php
//
// v2 supported block vocabulary:
//   triggers : before_insert/after_insert/before_update/after_update/
//              before_delete/after_delete (table), after_login/
//              before_logout/on_login_failure/after_user_created/
//              before_user_deleted/on_scheduled_task (project)
//   actions  : insert_record, update_record, delete_record, variable,
//              terminate_workflow, comment, send_email, http_request,
//              data_transformer, action (Advanced Action script:
//              insert/update/delete + parameterized raw SQL custom_query)
//   logic    : condition (flat comparison/logical expression),
//              if/then/else_if/else (nested ternary), for_each_loop,
//              switch, try_catch (with Catch branch)
//   tokens   : ##variable.name## interpolation in text fields
// Removed from the product (owner decision 2026-09-22, not worth the cost):
//   send_whatsapp (Meta template-approval policy), delay (needs async queue
//   infra). Old saved workflows containing these types are skipped safely.
// All remaining palette blocks generate real code (Telegram bot token comes
// from the Telegram Settings page at runtime).
// Anything unsupported compiles to an explicit `// [fixzy] ... not supported`
// comment so generated PHP always stays valid and gaps stay visible.

const fs = require('fs');
const path = require('path');
const pluralize = require('pluralize');
const { withBannerPhp } = require('../render/engine');

const IDENT = /^[a-z_][a-z0-9_]*$/i;

/** Validate a lowercase snake_case identifier; throws when unsafe. @param {string} name identifier @param {string} kind description used in the error @returns {string} the validated name */
function safeIdent(name, kind) {
    if (typeof name === 'string' && IDENT.test(name)) return name;
    throw new Error(`unsafe ${kind}: ${JSON.stringify(name)}`);
}

/** Render a value as a single-quoted PHP string literal. @param {*} v @returns {string} PHP string literal */
function phpString(v) {
    return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

// --- ##variable.name## token interpolation -------------------------------
// UI strings like "Hello ##variable.user_name##" compile to PHP:
//   'Hello ' . $user_name
// A lone token compiles to the bare variable (no string concat).
// Convention: ##variable.item## inside a for-each loop resolves to
// $__wf_loopItem (the current loop element).
const TOKEN_RE = /##(?:variable\.)?([a-zA-Z_][a-zA-Z0-9_]*)##/g;

/** Map a token name to its PHP variable name ('item' -> loop item). @param {string} raw token name @returns {string} variable name without '$' */
function tokenVarName(raw) {
    return raw === 'item' ? '__wf_loopItem' : raw;
}

/** Compile a ##variable##-tokenized string into a PHP concat expression. @param {*} raw string possibly containing tokens @returns {string} PHP expression (''' when empty) */
function compileTokenText(raw) {
    if (raw === null || raw === undefined) return "''";
    const s = String(raw);
    const parts = [];
    let last = 0;
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(s)) !== null) {
        if (m.index > last) parts.push(phpString(s.slice(last, m.index)));
        parts.push('$' + tokenVarName(m[1]));
        last = m.index + m[0].length;
    }
    if (parts.length === 0) return phpString(s);
    if (last < s.length) parts.push(phpString(s.slice(last)));
    return parts.join(' . ');
}

// Compile a math expression string (data_transformer) to a PHP expression.
// Tokens become variables; only arithmetic chars are allowed. Returns null
// when the expression contains anything else (fail-safe, never raw eval).
/** @param {*} raw math expression with ##token## vars @returns {string|null} PHP arithmetic expression or null */
function compileMathExpr(raw) {
    let s = String(raw || '');
    TOKEN_RE.lastIndex = 0;
    s = s.replace(TOKEN_RE, (mm, v) => '$' + tokenVarName(v));
    if (!/^[\w$+\-*/%().\s]+$/.test(s)) return null;
    // No stray identifiers: strip valid $vars, then no letters may remain.
    if (/[a-zA-Z]/.test(s.replace(/\$[a-zA-Z_][a-zA-Z0-9_]*/g, ''))) return null;
    return s.trim() || null;
}

// Map UI date format tokens (DD/MM/YYYY style) to PHP date() format chars.
/** @param {string} fmt UI date format @returns {string} PHP date() format string */
function mapDateFormat(fmt) {
    return String(fmt || 'YYYY-MM-DD').replace(
        /YYYY|MMMM|MMM|MM|DD|HH|hh|mm|ss/g,
        (t) => ({ YYYY: 'Y', MMMM: 'F', MMM: 'M', MM: 'm', DD: 'd', HH: 'H', hh: 'h', mm: 'i', ss: 's' }[t])
    );
}

// Compile one logic-builder value item to a PHP expression.
// Returns null when the item type is not supported in v1.
/** @param {object} item logic-builder value item {type, value, field?} @returns {string|null} PHP expression or null */
function compileValue(item) {
    if (!item || typeof item !== 'object') return null;
    switch (item.type) {
        case 'string': {
            const s = String(item.value ?? '');
            // Interpolate ##variable.x## tokens inside string values too.
            if (TOKEN_RE.test(s)) { TOKEN_RE.lastIndex = 0; return compileTokenText(s); }
            TOKEN_RE.lastIndex = 0;
            return phpString(s);
        }
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
/** @param {object[]} tokens flat token list (values + operators + parens) @returns {string|null} PHP boolean expression or null */
function compileFlat(tokens) {
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

// Compile a logic-builder token list that may contain if / then / else_if / else
// into a nested PHP ternary: (cond) ? a : (cond2 ? b : c).
// Falls back to the flat compiler when no control tokens are present.
/** @param {object[]} tokens logic-builder token list (may include if/then/else) @returns {string|null} PHP ternary expression or null */
function compileCondition(tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0) return null;
    const hasControl = tokens.some((t) => t && ['if', 'then', 'else', 'else_if'].includes(t.type));
    if (!hasControl) return compileFlat(tokens);

    // Split into segments: [if cond1] [then v1] [else_if cond2] [then v2] [else v3]
    const segments = [];
    let current = { kind: 'if', tokens: [] };
    for (const t of tokens) {
        if (!t) continue;
        if (t.type === 'if' || t.type === 'then' || t.type === 'else' || t.type === 'else_if') {
            if (current.tokens.length > 0 || current.kind !== 'if' || segments.length > 0) {
                segments.push(current);
            }
            current = { kind: t.type, tokens: [] };
        } else {
            current.tokens.push(t);
        }
    }
    if (current.tokens.length > 0) segments.push(current);

    // Validate: must start with if (or a bare condition), each then needs a value.
    const ifSeg = segments.find((s) => s.kind === 'if');
    const thenSegs = segments.filter((s) => s.kind === 'then');
    const elseSeg = segments.find((s) => s.kind === 'else');
    const elseIfSegs = segments.filter((s) => s.kind === 'else_if');
    if (!ifSeg || thenSegs.length === 0) return null;

    const cond = compileFlat(ifSeg.tokens);
    if (cond === null) return null;
    const thenVal = compileFlat(thenSegs[0].tokens);
    if (thenVal === null) return null;

    // Build the else-side: else_if chain first, else segment as final fallback.
    let elseExpr = null;
    if (elseIfSegs.length > 0) {
        const chain = [];
        for (let i = 0; i < elseIfSegs.length; i++) {
            const c = compileFlat(elseIfSegs[i].tokens);
            const t = thenSegs[i + 1] ? compileFlat(thenSegs[i + 1].tokens) : null;
            if (c === null || t === null) return null;
            chain.push({ cond: c, val: t });
        }
        const base = elseSeg ? compileFlat(elseSeg.tokens) : 'null';
        if (base === null) return null;
        elseExpr = chain
            .slice()
            .reverse()
            .reduce((acc, c) => `(${c.cond}) ? ${c.val} : ${acc}`, base);
    } else if (elseSeg) {
        elseExpr = compileFlat(elseSeg.tokens);
        if (elseExpr === null) return null;
    } else {
        elseExpr = 'null';
    }

    return `(${cond}) ? ${thenVal} : (${elseExpr})`;
}

// Compile a WHERE clause ({logic:'and'|'or', rules:[{field,operator,value}]})
// into a chain of ->where(...) calls on $query.
/** @param {object} where {logic:'and'|'or', rules:[{field,operator,value}]} @param {string} indent indentation for generated lines @returns {string|null} PHP where chain or null when empty */
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

// Compile http_request header rows [{key,value}] into a ->withHeaders([...]) chain.
/** @param {Array<{key: string, value: string}>} headers header rows @returns {string} ->withHeaders(...) chain ('' when none valid) */
function compileHeaders(headers) {
    const rows = Array.isArray(headers)
        ? headers.filter((h) => h && h.key && /^[A-Za-z0-9-]+$/.test(String(h.key)))
        : [];
    if (rows.length === 0) return '';
    const items = rows.map((h) => `        ${phpString(h.key)} => ${compileTokenText(h.value || '')},`);
    return `\n    ->withHeaders([\n${items.join('\n')}\n    ])`;
}

// Compile one action block's configData (flat token list) into PHP statements.
// Returns { code, unsupported } where code is an array of lines.
// ---- DB statement compilers (shared by standalone blocks and Advanced
// Action scripts). Each takes {table, details} and returns PHP lines or null.

/** Compile an insert_record statement into DB::table(...)->insert([...]) lines. @param {object} item {table, details:{values:[{field,value}]}} @returns {string[]|null} PHP lines or null when unusable */
function compileInsertStmt(item) {
    if (!item.table) return null;
    const table = safeIdent(item.table, 'table');
    const details = item.details || {};
    const values = Array.isArray(details.values) ? details.values : [];
    if (values.length === 0) return null;
    const lines = [`\\DB::table(${phpString(table)})->insert([`];
    values.forEach((p) => {
        const f = safeIdent(p.field, 'insert field');
        const v = compileValue(p.value) ?? phpString(p.value ?? '');
        lines.push(`    ${phpString(f)} => ${v},`);
    });
    lines.push(']);');
    return lines;
}

/** Compile an update_record statement (WHERE required; unbounded refused). @param {object} item {table, details:{set:[{field,value}], where}} @returns {string[]|null} PHP lines or null */
function compileUpdateStmt(item) {
    if (!item.table) return null;
    const table = safeIdent(item.table, 'table');
    const details = item.details || {};
    const set = Array.isArray(details.set) ? details.set : [];
    if (set.length === 0) return null;
    const whereChain = details.where ? compileWhere(details.where, '    ') : null;
    if (!whereChain) return null; // refuse unbounded update
    const lines = [`\\DB::table(${phpString(table)})`, whereChain];
    lines.push('    ->update([');
    set.forEach((p) => {
        const f = safeIdent(p.field, 'update field');
        const v = compileValue(p.value) ?? phpString(p.value ?? '');
        lines.push(`        ${phpString(f)} => ${v},`);
    });
    lines.push('    ]);');
    return lines;
}

/** Compile a delete_record statement (WHERE required; unbounded refused). @param {object} item {table, details:{where}} @returns {string[]|null} PHP lines or null */
function compileDeleteStmt(item) {
    if (!item.table) return null;
    const table = safeIdent(item.table, 'table');
    const details = item.details || {};
    const whereChain = details.where ? compileWhere(details.where, '    ') : null;
    if (!whereChain) return null; // refuse unbounded delete
    return [`\\DB::table(${phpString(table)})`, whereChain, '    ->delete();'];
}

// Compile a raw SQL token (Advanced Action -> custom_query) into a safe
// parameterized call. Owner-approved option (a): raw SQL IS allowed, but:
//   * DDL / destructive-admin statements are REJECTED (DROP, TRUNCATE, ...)
//   * multiple statements (internal ;) are REJECTED
//   * ##variable.x## tokens become ? placeholders with bound PHP variables
//   * the generated line carries a visible provenance comment
// Returns { lines: [...] } or { error: 'reason' }.
const RAW_SQL_FORBIDDEN = /\b(drop|truncate|alter|create|rename|grant|revoke|attach|detach|shutdown|kill|set\s+global|load_file|into\s+outfile|into\s+dumpfile)\b/i;

/**
 * Compile a raw SQL token (Advanced Action -> custom_query) into a safe
 * parameterized DB call. DDL/multi-statement SQL is rejected; ##var##
 * tokens become ? placeholders with bound PHP variables.
 * @param {string} raw raw SQL text from the workflow block
 * @returns {{lines: string[]}|{error: string}} generated lines or rejection reason
 */
function compileRawSql(raw) {
    let sql = String(raw || '').trim();
    if (!sql) return { error: 'custom_query is empty' };
    // Strip a single trailing semicolon; internal ones = multi-statement.
    if (sql.endsWith(';')) sql = sql.slice(0, -1).trim();
    if (sql.includes(';')) return { error: 'multiple SQL statements are not allowed' };
    if (!/^(select|insert|update|delete|replace)\b/i.test(sql)) {
        return { error: 'only SELECT/INSERT/UPDATE/DELETE/REPLACE statements are allowed' };
    }
    if (RAW_SQL_FORBIDDEN.test(sql)) return { error: 'forbidden statement detected in SQL' };

    // Interpolate ##var## tokens into ? placeholders + bindings.
    const bindings = [];
    TOKEN_RE.lastIndex = 0;
    sql = sql.replace(TOKEN_RE, (mm, v) => {
        bindings.push('$' + tokenVarName(v));
        return '?';
    });
    if (/\?/.test(sql) && bindings.length === 0) {
        return { error: 'unbound ? placeholder in SQL (write ##variable## instead of ?)' };
    }

    const isSelect = /^\s*select\b/i.test(sql);
    const lines = [`// Raw SQL from workflow Advanced Action (parameterized).`];
    if (bindings.length === 0) {
        lines.push(isSelect
            ? `\\DB::select(${phpString(sql)})`
            : `\\DB::statement(${phpString(sql)})`);
    } else {
        lines.push(isSelect
            ? `\\DB::select(${phpString(sql)}, [${bindings.join(', ')}])`
            : `\\DB::statement(${phpString(sql)}, [${bindings.join(', ')}])`);
    }
    lines[lines.length - 1] += ';';
    return { lines };
}

/**
 * Compile one action block's configData (flat token list) into PHP statements.
 * @param {object} block workflow action block {type, configData, table, details}
 * @param {string} [recordVar] record variable name for this_record_data
 * @returns {string[]} PHP statement lines (unsupported blocks become // comments)
 */
function compileAction(block, recordVar) {
    const lines = [];
    let tokens = [];
    try {
        tokens = JSON.parse(block.configData || '[]');
    } catch (e) {
        tokens = [];
    }
    if (!Array.isArray(tokens)) tokens = [];

    /** Append an explicit "not supported in v1" skip comment. @param {string} why what was skipped @returns {void} */
    const pushUnsupported = (why) =>
        lines.push(`// [fixzy] ${why} — not supported in v1, skipped.`);

    switch (block.type) {
        case 'insert_record': {
            const item = { table: block.table, details: block.details || (tokens[0] && tokens[0].details) || {} };
            const stmt = compileInsertStmt(item);
            if (!stmt) { pushUnsupported('insert_record without target table or field values'); break; }
            lines.push(...stmt);
            break;
        }
        case 'update_record': {
            const tok = tokens[0] || {};
            const item = { table: block.table || tok.table, details: block.details || tok.details || {} };
            const stmt = compileUpdateStmt(item);
            if (!stmt) { pushUnsupported('update_record needs SET values and a WHERE clause (unbounded updates are refused)'); break; }
            lines.push(...stmt);
            break;
        }
        case 'delete_record': {
            const tok = tokens[0] || {};
            const item = { table: block.table || tok.table, details: block.details || tok.details || {} };
            const stmt = compileDeleteStmt(item);
            if (!stmt) { pushUnsupported('delete_record needs a WHERE clause (unbounded deletes are refused)'); break; }
            lines.push(...stmt);
            break;
        }
        case 'action': {
            // Advanced Action: a script of DB statements authored in the
            // Algorithm Builder (ACTION_SCRIPT_GRAMMAR). Each token is one
            // statement: insert_record / update_record / delete_record /
            // custom_query (raw SQL, parameterized — owner option (a)).
            if (tokens.length === 0) { pushUnsupported('advanced action with empty script'); break; }
            tokens.forEach((tok, i) => {
                if (!tok || typeof tok !== 'object') return;
                if (tok.type === 'comment') {
                    lines.push(`// ${String(tok.value ?? '').replace(/\r?\n/g, ' ')}`);
                } else if (tok.type === 'insert_record') {
                    const stmt = compileInsertStmt(tok);
                    lines.push(...(stmt || [`// [fixzy] script step ${i + 1}: insert_record without table/values — skipped.`]));
                } else if (tok.type === 'update_record') {
                    const stmt = compileUpdateStmt(tok);
                    lines.push(...(stmt || [`// [fixzy] script step ${i + 1}: update_record needs SET + WHERE — skipped.`]));
                } else if (tok.type === 'delete_record') {
                    const stmt = compileDeleteStmt(tok);
                    lines.push(...(stmt || [`// [fixzy] script step ${i + 1}: delete_record needs WHERE — skipped.`]));
                } else if (tok.type === 'custom_query') {
                    const r = compileRawSql(tok.value);
                    if (r.error) lines.push(`// [fixzy] script step ${i + 1}: raw SQL rejected — ${r.error}`);
                    else lines.push(...r.lines);
                } else {
                    lines.push(`// [fixzy] script step ${i + 1}: token type '${tok.type}' not supported — skipped.`);
                }
            });
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
        case 'send_telegram': {
            // Bot token comes from the Telegram Settings page at runtime
            // (never hardcoded). Chat ID: block field, else default setting.
            const chatId = compileTokenText(block.chat_id || '');
            const message = compileTokenText(block.message || '');
            lines.push('$__wf_tgChat = ' + chatId + ';');
            lines.push('if ($__wf_tgChat === \'\') { $__wf_tgChat = \\App\\Models\\FixzySetting::get(\'telegram_default_chat_id\', \'\'); }');
            lines.push('$__wf_tgToken = \\App\\Models\\FixzySetting::get(\'telegram_bot_token\', \'\');');
            lines.push('if ($__wf_tgChat !== \'\' && $__wf_tgToken !== \'\') {');
            lines.push('    \\Illuminate\\Support\\Facades\\Http::timeout(15)->asJson()->post(');
            lines.push('        \'https://api.telegram.org/bot\' . $__wf_tgToken . \'/sendMessage\',');
            lines.push('        [\'chat_id\' => $__wf_tgChat, \'text\' => ' + message + ']');
            lines.push('    );');
            lines.push('}');
            break;
        }
        case 'terminate_workflow':
            lines.push('return;');
            break;
        case 'send_email': {
            // Assign to temp vars first: PHP's use() only accepts variables.
            const to = compileTokenText(block.to || '');
            const subject = compileTokenText(block.subject || '(no subject)');
            const body = compileTokenText(block.body || '');
            lines.push('$__wf_to = ' + to + ';');
            lines.push('$__wf_subject = ' + subject + ';');
            lines.push('$__wf_body = ' + body + ';');
            lines.push('if (!empty($__wf_to)) {');
            lines.push('    \\Illuminate\\Support\\Facades\\Mail::raw($__wf_body, function ($msg) use ($__wf_to, $__wf_subject) {');
            lines.push('        $msg->to($__wf_to);');
            if (block.cc) lines.push(`        $msg->cc(${compileTokenText(block.cc)});`);
            if (block.bcc) lines.push(`        $msg->bcc(${compileTokenText(block.bcc)});`);
            lines.push('        $msg->subject($__wf_subject);');
            lines.push('    });');
            lines.push('}');
            break;
        }
        case 'http_request': {
            const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(block.method || '').toUpperCase())
                ? String(block.method).toUpperCase() : 'GET';
            const url = compileTokenText(block.url || '');
            const outVar = block.outputVariableName ? safeIdent(block.outputVariableName, 'output variable') : null;
            const body = block.body ? compileTokenText(block.body) : null;
            const assign = outVar ? `$${outVar} = ` : '';
            lines.push(`${assign}\\Illuminate\\Support\\Facades\\Http::timeout(15)${compileHeaders(block.headers)}`);
            lines.push(`    ->${method.toLowerCase()}(${url}${body ? ', ' + body : ''});`);
            if (outVar) {
                lines.push(`if ($${outVar}->failed()) {`);
                lines.push(`    // [fixzy] HTTP ${method} returned an error status; $${outVar}->status() has the code.`);
                lines.push('}');
            }
            break;
        }
        case 'data_transformer': {
            const outVar = block.outputVariableName ? safeIdent(block.outputVariableName, 'output variable') : null;
            if (!outVar) { pushUnsupported('data_transformer without an output variable name'); break; }
            const input = compileTokenText(block.inputValue || '');
            const fn = String(block.selectedFunction || 'format_date');
            if (fn === 'format_date') {
                const fmt = mapDateFormat((block.parameters || {}).dateFormat);
                lines.push(`$${outVar} = \\Illuminate\\Support\\Facades\\Date::parse(${input})->format(${phpString(fmt)});`);
            } else if (fn === 'text_operation') {
                const op = String((block.parameters || {}).textOperation || 'uppercase');
                const phpFn = op === 'lowercase' ? 'strtolower' : 'strtoupper';
                lines.push(`$${outVar} = ${phpFn}((string) ${input});`);
            } else if (fn === 'math_operation') {
                const expr = compileMathExpr((block.parameters || {}).mathExpression);
                if (expr === null) { pushUnsupported('math expression contains disallowed characters'); break; }
                lines.push(`$${outVar} = ${expr};`);
            } else {
                pushUnsupported(`data_transformer function '${fn}'`);
            }
            break;
        }
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
/**
 * @param {object} ctx workflow context from buildCtx
 * @param {string|null} startId starting block id
 * @param {string} indentStr indentation for generated lines
 * @param {Set<string>} visited block ids already emitted (cycle guard)
 * @returns {string[]} PHP statement lines
 */
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

        if (block.type === 'for_each_loop') {
            const source = compileTokenText(block.dataSource || '');
            const bodyNext = ctx.nextOf(cur, 'out-body');
            const doneNext = ctx.nextOf(cur, 'out-complete');
            lines.push(`${indentStr}foreach ((array) ${source} as $__wf_loopItem) {`);
            lines.push(...walkChain(ctx, bodyNext, indentStr + '    ', visited));
            lines.push(`${indentStr}}`);
            cur = doneNext; // continue after the loop
            continue;
        }

        if (block.type === 'switch') {
            const subject = compileTokenText(block.switchValue || '');
            const cases = Array.isArray(block.cases) ? block.cases : [];
            lines.push(`${indentStr}switch (${subject}) {`);
            cases.forEach((c, i) => {
                const caseNext = ctx.nextOf(cur, `out-case-${i}`);
                if (!caseNext) {
                    lines.push(`${indentStr}    // case ${phpString(c && c.value != null ? c.value : i)}: (not connected)`);
                    return;
                }
                lines.push(`${indentStr}    case ${compileTokenText(c && c.value != null ? c.value : '')}:`);
                lines.push(...walkChain(ctx, caseNext, indentStr + '        ', visited));
                lines.push(`${indentStr}        break;`);
            });
            const defaultNext = ctx.nextOf(cur, 'out-default');
            lines.push(`${indentStr}    default:`);
            lines.push(...walkChain(ctx, defaultNext, indentStr + '        ', visited));
            lines.push(`${indentStr}}`);
            break; // switch owns the rest of the flow
        }

        if (block.type === 'try_catch') {
            const tryNext = ctx.nextOf(cur, 'out-try');
            const catchNext = ctx.nextOf(cur, 'out-catch');
            lines.push(`${indentStr}try {`);
            lines.push(...walkChain(ctx, tryNext, indentStr + '    ', visited));
            lines.push(`${indentStr}} catch (\\Throwable $e) {`);
            if (catchNext) {
                lines.push(...walkChain(ctx, catchNext, indentStr + '    ', visited));
            } else {
                lines.push(`${indentStr}    // [fixzy] workflow error swallowed (no Catch branch connected).`);
            }
            lines.push(`${indentStr}}`);
            break;
        }

        lines.push(...compileAction(block).map((l) => (l.startsWith('//') ? indentStr + l : indentStr + l)));
        cur = ctx.nextOf(cur, 'out');
    }
    return lines;
}

/**
 * Build the traversal context: block map + nextOf(blockId, outPoint) lookup.
 * @param {object} blocks map of block id -> block
 * @param {Array<{fromBlock: string, fromPoint: string, toBlock: string}>} connections graph edges
 * @returns {{blocks: object, nextOf: (id: string, point: string) => string|null}}
 */
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

/** Find all hook_trigger blocks with a hook_type set. @param {object} blocks block map @returns {Array<[string, object]>} [blockId, block] pairs */
function findTriggers(blocks) {
    return Object.entries(blocks || {}).filter(([, b]) => b.type === 'hook_trigger' && b.hook_type);
}

/** Derive the Eloquent model class name for a table (module_name aware). @param {string} tableName @param {object} tables table map @returns {string} PascalCase singular class name */
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

/**
 * Compile every trigger chain of a workflow graph into PHP body lines.
 * @param {object} blocks workflow block map
 * @param {Array} connections graph edges
 * @param {string} recordVar record variable name for this_record_data
 * @returns {string[]} PHP statement lines
 */
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

/**
 * Render a model observer PHP file from compiled hook methods.
 * @param {string} modelClass Eloquent model class name
 * @param {string} tableName source table name (for the docblock)
 * @param {Array<{name: string, body: string[]}>} methods observer methods
 * @returns {string} full PHP file contents
 */
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

/**
 * Render the ProjectWorkflowListener PHP file from compiled project hooks.
 * @param {Array<{method: string, typeHint: string, body: string[]}>} projectHooks compiled hooks
 * @returns {string} full PHP file contents
 */
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

/**
 * Render the WorkflowServiceProvider PHP file (observer registration,
 * event listeners, scheduled command, mail settings overlay).
 * @param {Array<{modelClass: string, observerClass: string}>} tableObservers observer registrations
 * @param {Array<{method: string, eventClass: string}>} projectHooks event listener registrations
 * @param {boolean} hasScheduled whether the on_scheduled_task hook exists
 * @param {string[]|null} startupBody compiled on_startup workflow body
 * @returns {string} full PHP file contents
 */
function buildProviderPhp(tableObservers, projectHooks, hasScheduled, startupBody) {
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
    if (tableObservers.length === 0 && projectHooks.length === 0 && !hasScheduled && !(startupBody && startupBody.length)) {
        parts.push('        // No workflows configured.');
    }
    if (startupBody && startupBody.length) {
        parts.push('        // on_startup workflow (runs once when the app boots).');
        parts.push('        $this->runStartupWorkflow();');
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
    parts.push('        $this->applyMailSettings();');
    parts.push('    }');
    parts.push('');
    parts.push('    /**');
    parts.push('     * Apply admin-configured SMTP settings (Mail Settings page) over');
    parts.push('     * the .env defaults so workflow emails work without redeploying.');
    parts.push('     */');
    parts.push('    protected function applyMailSettings(): void');
    parts.push('    {');
    parts.push('        try {');
    parts.push('            if (!\\Illuminate\\Support\\Facades\\Schema::hasTable("fixzy_settings")) {');
    parts.push('                return; // migrate:fresh not done yet');
    parts.push('            }');
    parts.push('        } catch (\\Throwable) {');
    parts.push('            return; // database not reachable yet (e.g. sqlite file missing during key:generate)');
    parts.push('        }');
    parts.push('        $s = fn (string $k, $d = null) => \\App\\Models\\FixzySetting::get($k, $d);');
    parts.push('        if ($s("mail_host")) {');
    parts.push('            config(["mail.default" => "smtp"]);');
    parts.push('            config(["mail.mailers.smtp.host" => $s("mail_host")]);');
    parts.push('            config(["mail.mailers.smtp.port" => (int) $s("mail_port", "587")]);');
    parts.push('            config(["mail.mailers.smtp.username" => $s("mail_username")]);');
    parts.push('            config(["mail.mailers.smtp.password" => $s("mail_password")]);');
    parts.push('            config(["mail.mailers.smtp.encryption" => $s("mail_encryption", "tls") ?: null]);');
    parts.push('        }');
    parts.push('        if ($s("mail_from_address")) {');
    parts.push('            config(["mail.from.address" => $s("mail_from_address")]);');
    parts.push('            config(["mail.from.name" => $s("mail_from_name", config("app.name"))]);');
    parts.push('        }');
    parts.push('    }');
    if (startupBody && startupBody.length) {
        parts.push('');
        parts.push('    protected function runStartupWorkflow(): void');
        parts.push('    {');
        parts.push(...startupBody);
        parts.push('    }');
    }
    parts.push('}');
    parts.push('');
    return parts.join('\n');
}

/**
 * Render the ScheduledWorkflowCommand (fixzy:scheduled-workflow) PHP file.
 * @param {string[]} body compiled workflow body lines
 * @returns {string} full PHP file contents
 */
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
        // terminate_workflow compiles to bare `return;` which is invalid in a
        // method with an int return type — map it to SUCCESS.
        parts.push(...body.map((l) => {
            const t = l.replace(/^ {8}/, '        ');
            return t.trim() === 'return;' ? '        return self::SUCCESS;' : t;
        }));
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
 * @param {string} outputDir generated app root
 * @returns {Promise<{success: boolean, files?: string[], message?: string}>}
 */
async function generateWorkflowHooks(fullSchema, outputDir) {
    try {
        const project = fullSchema.project || {};
        const tables = (fullSchema.database && fullSchema.database.table) || {};

        /** Parse a stored workflow JSON string into {blocks,...} or null. @param {*} raw JSON string/null @returns {object|null} */
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
                withBannerPhp(buildObserverPhp(modelClass, tableName, methods))
            );
            tableObservers.push({ modelClass, observerClass });
        }

        // ---- project hooks ----
        const projectWf = parse(project.project_hook_workflow);
        const projectHooks = [];
        let scheduledBody = null;
        let startupBody = null;
        if (projectWf) {
            const triggers = findTriggers(projectWf.blocks);
            for (const [tid, tb] of triggers) {
                const ctx = buildCtx(projectWf.blocks, wfConnectionsSafe(projectWf));
                const body = walkChain(ctx, ctx.nextOf(tid, 'out'), '        ', new Set([tid]));
                if (tb.hook_type === 'on_scheduled_task') {
                    scheduledBody = body;
                    continue;
                }
                if (tb.hook_type === 'on_startup') {
                    startupBody = body;
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
        /** Return a workflow's connections array, [] when missing. @param {object} wf parsed workflow @returns {Array} */
        function wfConnectionsSafe(wf) { return wf.connections || []; }

        const hasScheduled = scheduledBody !== null;
        if (hasScheduled) {
            const cmdDir = path.join(outputDir, 'app', 'Console', 'Commands');
            fs.mkdirSync(cmdDir, { recursive: true });
            fs.writeFileSync(
                path.join(cmdDir, 'ScheduledWorkflowCommand.php'),
                withBannerPhp(buildScheduledCommandPhp(scheduledBody))
            );
        }

        // Settings store + Mail Settings page are ALWAYS generated (before the
        // early return) so every generated app ships an admin SMTP config page,
        // whether or not a workflow currently uses it. Same fixed filenames as
        // the auth integrations generator, so running both is idempotent.
        const { renderTemplate } = require('../render/engine');
        const settingsModel = path.join(outputDir, 'app', 'Models', 'FixzySetting.php');
        if (!fs.existsSync(settingsModel)) {
            fs.mkdirSync(path.dirname(settingsModel), { recursive: true });
            fs.writeFileSync(settingsModel, renderTemplate('app/Models/FixzySetting.php.njk', {}));
            const migDir = path.join(outputDir, 'database', 'migrations');
            fs.mkdirSync(migDir, { recursive: true });
            const migFile = path.join(migDir, '2026_09_22_000001_create_fixzy_settings_table.php');
            if (!fs.existsSync(migFile)) {
                fs.writeFileSync(migFile, renderTemplate('database/migrations/create_fixzy_settings_table.php.njk', {}));
            }
        }
        const mailPage = path.join(outputDir, 'app', 'Filament', 'Pages', 'MailSettings.php');
        if (!fs.existsSync(mailPage)) {
            fs.mkdirSync(path.dirname(mailPage), { recursive: true });
            fs.writeFileSync(mailPage, renderTemplate('app/Filament/Pages/MailSettings.php.njk', {}));
            const mailView = path.join(outputDir, 'resources', 'views', 'filament', 'pages', 'mail-settings.blade.php');
            fs.mkdirSync(path.dirname(mailView), { recursive: true });
            fs.writeFileSync(mailView, renderTemplate('resources/views/filament/pages/mail-settings.blade.php.njk', {}));
        }
        const tgPage = path.join(outputDir, 'app', 'Filament', 'Pages', 'TelegramSettings.php');
        if (!fs.existsSync(tgPage)) {
            fs.mkdirSync(path.dirname(tgPage), { recursive: true });
            fs.writeFileSync(tgPage, renderTemplate('app/Filament/Pages/TelegramSettings.php.njk', {}));
            const tgView = path.join(outputDir, 'resources', 'views', 'filament', 'pages', 'telegram-settings.blade.php');
            fs.mkdirSync(path.dirname(tgView), { recursive: true });
            fs.writeFileSync(tgView, renderTemplate('resources/views/filament/pages/telegram-settings.blade.php.njk', {}));
        }

        // The provider is ALWAYS generated: even with no workflow blocks it
        // carries applyMailSettings(), which the Mail Settings page needs.
        if (projectHooks.length > 0) {
            const listenersDir = path.join(outputDir, 'app', 'Listeners');
            fs.mkdirSync(listenersDir, { recursive: true });
            fs.writeFileSync(
                path.join(listenersDir, 'ProjectWorkflowListener.php'),
                withBannerPhp(buildListenerPhp(projectHooks))
            );
        }

        const providersDir = path.join(outputDir, 'app', 'Providers');
        fs.mkdirSync(providersDir, { recursive: true });

        fs.writeFileSync(
            path.join(providersDir, 'WorkflowServiceProvider.php'),
            withBannerPhp(buildProviderPhp(tableObservers, projectHooks, hasScheduled, startupBody))
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

        // Manifest: the deploy/preview flow registers providers from
        // fixzy-manifest.json into the staging app's bootstrap/providers.php.
        // Without this, workflow observers never boot in staged apps.
        const manifestPath = path.join(outputDir, 'fixzy-manifest.json');
        let manifest = { composer: [], php_extensions: [], npm: [], providers: [] };
        if (fs.existsSync(manifestPath)) {
            try {
                const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                manifest = {
                    composer: Array.isArray(existing.composer) ? existing.composer : [],
                    php_extensions: Array.isArray(existing.php_extensions) ? existing.php_extensions : [],
                    npm: Array.isArray(existing.npm) ? existing.npm : [],
                    providers: Array.isArray(existing.providers) ? existing.providers : [],
                };
            } catch (e) { /* corrupt manifest: start fresh */ }
        }
        const wfProviderClass = 'App\\Providers\\WorkflowServiceProvider';
        if (!manifest.providers.includes(wfProviderClass)) {
            manifest.providers.push(wfProviderClass);
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        return {
            success: true,
            message: `Workflow hooks: ${tableObservers.length} observer(s), ${projectHooks.length} project listener(s)${hasScheduled ? ', 1 scheduled command' : ''}.`,
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = { generateWorkflowHooks, compileCondition, compileValue, compileTokenText, modelClassName };
