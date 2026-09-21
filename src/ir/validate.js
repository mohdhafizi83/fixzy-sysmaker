// IR validator: validates an IR object against docs/IR_SCHEMA.json.
// Uses a minimal built-in checker (no heavy deps) covering: required fields,
// types, enums, patterns. Returns { valid, errors: [ {path, message} ] }.

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'docs', 'IR_SCHEMA.json');

function loadSchema() {
    return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v; // string, number, boolean, object
}

function resolveRef(schema, root) {
    if (!schema || !schema.$ref) return schema;
    const p = schema.$ref.replace(/^#\/?/, '').split('/').filter(Boolean);
    let cur = root;
    for (const seg of p) cur = cur[seg];
    if (!cur) throw new Error(`Unresolvable $ref: ${schema.$ref}`);
    return cur;
}

function checkType(value, types) {
    const t = typeOf(value);
    const list = Array.isArray(types) ? types : [types];
    return list.some((allowed) => {
        if (allowed === 'integer') return t === 'number' && Number.isInteger(value);
        if (allowed === 'number') return t === 'number';
        return t === allowed;
    });
}

function validateNode(value, schema, root, pathStr, errors) {
    schema = resolveRef(schema, root);
    if (!schema || typeof schema !== 'object') return;

    if (schema.const !== undefined && value !== schema.const) {
        errors.push({ path: pathStr, message: `must equal ${JSON.stringify(schema.const)}` });
        return;
    }
    if (schema.enum) {
        // enum may legitimately contain null
        if (!schema.enum.includes(value)) {
            errors.push({ path: pathStr, message: `must be one of ${JSON.stringify(schema.enum)}` });
            return;
        }
    }
    if (schema.type && !checkType(value, schema.type)) {
        errors.push({ path: pathStr, message: `expected type ${JSON.stringify(schema.type)}, got ${typeOf(value)}` });
        return;
    }
    if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
        errors.push({ path: pathStr, message: `does not match pattern ${schema.pattern}` });
    }

    const t = typeOf(value);
    if (t === 'object') {
        const props = schema.properties || {};
        for (const req of schema.required || []) {
            if (!(req in value)) errors.push({ path: `${pathStr}.${req}`, message: 'required property missing' });
        }
        for (const [k, v] of Object.entries(value)) {
            if (props[k]) {
                validateNode(v, props[k], root, `${pathStr}.${k}`, errors);
            } else if (!schema.additionalProperties && schema.additionalProperties !== true) {
                // unknown key in a closed object: warn-level only (presentation bags are open)
                if (!pathStr.endsWith('presentation')) {
                    errors.push({ path: `${pathStr}.${k}`, message: 'unknown property (not in schema)' });
                }
            }
        }
    } else if (t === 'array' && schema.items) {
        value.forEach((item, i) => validateNode(item, schema.items, root, `${pathStr}[${i}]`, errors));
    }
}

function validateIR(ir, schema) {
    schema = schema || loadSchema();
    const errors = [];
    validateNode(ir, schema, schema, 'ir', errors);
    return { valid: errors.length === 0, errors };
}

module.exports = { validateIR, loadSchema };

// CLI: node src/ir/validate.js <ir.json>
if (require.main === module) {
    const file = process.argv[2];
    if (!file) { console.error('usage: node src/ir/validate.js <ir.json>'); process.exit(2); }
    const ir = JSON.parse(fs.readFileSync(file, 'utf8'));
    const { valid, errors } = validateIR(ir);
    if (valid) { console.log('IR VALID'); process.exit(0); }
    console.error(`IR INVALID (${errors.length} errors):`);
    for (const e of errors.slice(0, 50)) console.error(`  ${e.path}: ${e.message}`);
    process.exit(1);
}
