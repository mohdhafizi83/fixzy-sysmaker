// Unit tests for the post-generation validator (Phase 2.2).
// Each rule must fire on a deliberately broken input, and stay silent on a
// clean input. Run: node test/render_validate_test.js

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateGeneratedFile, validateGeneratedTree } = require('../src/render/validate');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-rv-'));
let pass = 0, fail = 0;

function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  PASS ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

function write(name, content) {
    const p = path.join(tmp, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
    return p;
}

console.log('rule: php-lint');
{
    const p = write('bad/Broken.php', "<?php\nclass Broken { function x( { }\n");
    const r = validateGeneratedFile(p, {});
    check('broken php fires php-lint', r.errors.some((e) => e.rule === 'php-lint'));
}
{
    const p = write('good/Ok.php', "<?php\n\nclass Ok\n{\n    public int \$a = 1;\n}\n");
    const r = validateGeneratedFile(p, {});
    check('clean php no php-lint', !r.errors.some((e) => e.rule === 'php-lint'), JSON.stringify(r.errors));
}

console.log('rule: leftover-placeholder');
{
    const p = write('ph/Left.php', "<?php\n// TODO: <<TABLE_NAME>> not replaced\nclass Left {}\n");
    const r = validateGeneratedFile(p, {});
    check('<<PLACEHOLDER>> fires', r.errors.some((e) => e.rule === 'leftover-placeholder'));
}

console.log('rule: leftover-nunjucks');
{
    const p = write('njk/Unrendered.php', "<?php\n{% if x %}\nclass Unrendered { \$name = '{{ name }}'; }\n");
    const r = validateGeneratedFile(p, {});
    check('nunjucks artifacts fire', r.errors.some((e) => e.rule === 'leftover-nunjucks'));
}
{
    // Blade files legitimately contain {{ }} — must NOT fire
    const p = write('njk/good.blade.php', "<div>{{ \$title }}</div>\n");
    const r = validateGeneratedFile(p, {});
    check('blade {{ }} does NOT fire', !r.errors.some((e) => e.rule === 'leftover-nunjucks'), JSON.stringify(r.errors));
}

console.log('rule: unused-import');
{
    const p = write('imp/Unused.php', "<?php\n\nnamespace App\\Imp;\n\nuse App\\Models\\NeverUsed;\nuse App\\Models\\ActuallyUsed;\n\nclass Unused\n{\n    public function go()\n    {\n        return new ActuallyUsed();\n    }\n}\n");
    const r = validateGeneratedFile(p, {});
    const unused = r.errors.filter((e) => e.rule === 'unused-import');
    check('unused import fires', unused.length === 1 && unused[0].message.includes('NeverUsed'), JSON.stringify(unused));
    check('used import silent', !unused.some((e) => e.message.includes('ActuallyUsed')));
}
{
    // alias case
    const p = write('imp/Aliased.php', "<?php\n\nnamespace App\\Imp;\n\nuse App\\Models\\Foo as Bar;\n\nclass Aliased\n{\n    public function go() { return new Bar(); }\n}\n");
    const r = validateGeneratedFile(p, {});
    check('aliased import used via alias = silent', !r.errors.some((e) => e.rule === 'unused-import'), JSON.stringify(r.errors));
}

console.log('rule: namespace-path');
{
    const p = write('ns/app/Filament/Pages/Wrong.php', "<?php\n\nnamespace App\\Filament\\Widgets;\n\nclass Wrong {}\n");
    const r = validateGeneratedFile(p, { basePath: path.join(tmp, 'ns') });
    check('mismatched namespace fires', r.errors.some((e) => e.rule === 'namespace-path'), JSON.stringify(r.errors));
}
{
    const p = write('nsok/app/Filament/Pages/Right.php', "<?php\n\nnamespace App\\Filament\\Pages;\n\nclass Right {}\n");
    const r = validateGeneratedFile(p, { basePath: path.join(tmp, 'nsok') });
    check('matching namespace silent', !r.errors.some((e) => e.rule === 'namespace-path'), JSON.stringify(r.errors));
}

console.log('tree validation');
{
    const tree = path.join(tmp, 'tree');
    write(path.join('tree', 'app', 'Models', 'Good.php'), "<?php\n\nnamespace App\\Models;\n\nclass Good {}\n");
    const rep = validateGeneratedTree(tree, {});
    check('clean tree errorCount 0', rep.errorCount === 0, JSON.stringify(rep.files));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n=== render validator tests: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
