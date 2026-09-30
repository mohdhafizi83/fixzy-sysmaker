// CM round-trip: custom module MatriksKhas form test
'use strict';
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const failures = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; failures.push(name + (extra ? ' [' + extra + ']' : '')); console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1200 } });
  const pageErrors = [];
  p.on('pageerror', e => pageErrors.push(String(e).slice(0, 150)));
  await p.goto('http://127.0.0.1:8901/admin/login', { waitUntil: 'networkidle' });
  await p.fill('input[type=email]', 'admin@admin.com');
  await p.fill('input[type=password]', 'password');
  await p.click('button[type=submit]');
  await p.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 });

  // 0. seed parent watak rows (DB is fresh after boot)
  const { execSync } = require('child_process');
  execSync('php ' + __dirname + '/cm_seed.php');

  // 1. custom module create page loads
  const resp = await p.goto('http://127.0.0.1:8901/admin/matrikskhas/create', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  check('CM1. custom module create page loads (200)', resp.status() === 200, 'status=' + resp.status());
  const hasForm = await p.locator('#form\\.txt_plain').count();
  check('CM2. form fields render', hasForm > 0);

  // 3. readonly override: num_decimal disabled
  const decDisabled = await p.locator('#form\\.num_decimal').isDisabled().catch(() => false);
  check('CM3. num_decimal readonly override (disabled)', decDisabled === true);

  // 4. fill and submit via custom module
  await p.fill('#form\\.txt_plain', 'CM Roundtrip');
  await p.fill('#form\\.txt_email', 'cm@example.com');
  await p.fill('#form\\.num_int', '777');
  await p.selectOption('#form\\.opt_dropdown', 'tiga');
  await p.selectOption('#form\\.lk_dropdown', { label: 'Watak Satu' });
  await p.getByRole('button', { name: 'Create', exact: true }).first().click();
  await sleep(4000);
  const stillCreate = p.url().includes('/create');
  const errs = await p.evaluate(() => Array.from(document.querySelectorAll('.fi-fo-field-wrp-error-message, .fi-field-error-message')).map(e => e.textContent.trim()).filter(Boolean).slice(0, 5));
  check('CM4. custom module create submits', !stillCreate && errs.length === 0, 'stillCreate=' + stillCreate + ' errs=' + JSON.stringify(errs));

  // 5. DB row created
  let row = null;
  try {
    const out = execSync(`php -r '$db=new PDO("sqlite:/tmp/fsm-matrix-app/database/database.sqlite"); $r=$db->query("SELECT * FROM matriks ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC); echo json_encode($r);'`, { encoding: 'utf8' });
    row = JSON.parse(out);
  } catch (e) { console.log('db err', e.message); }
  check('CM5. row created via custom module', !!row && row.txt_plain === 'CM Roundtrip', row ? row.txt_plain : 'no row');
  check('CM6. num_int saved 777', row && String(row.num_int) === '777', row ? String(row.num_int) : '');
  check('CM7. opt_dropdown saved tiga', row && row.opt_dropdown === 'tiga', row ? row.opt_dropdown : '');
  check('CM8. lk_dropdown saved', row && row.lk_dropdown != null && row.lk_dropdown !== '', row ? String(row.lk_dropdown) : '');

  // 9. edit page loads with values
  if (row && row.id) {
    const r2 = await p.goto(`http://127.0.0.1:8901/admin/matrikskhas/${row.id}/edit`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    check('CM9. custom module edit loads', r2.status() === 200, 'status=' + r2.status());
    const loaded = await p.locator('#form\\.txt_plain').inputValue().catch(() => '');
    check('CM10. edit shows saved value', loaded === 'CM Roundtrip', loaded);
    const decDisabled2 = await p.locator('#form\\.num_decimal').isDisabled().catch(() => false);
    check('CM11. readonly persists on edit', decDisabled2 === true);
    // update via custom module
    await p.fill('#form\\.txt_plain', 'CM Updated');
    await p.getByRole('button', { name: /Save/ }).first().click();
    await sleep(4000);
    const row2 = JSON.parse(execSync(`php -r '$db=new PDO("sqlite:/tmp/fsm-matrix-app/database/database.sqlite"); $r=$db->query("SELECT * FROM matriks WHERE id=${row.id}")->fetch(PDO::FETCH_ASSOC); echo json_encode($r);'`, { encoding: 'utf8' }));
    check('CM12. update via custom module', String(row2.txt_plain) === 'CM Updated', String(row2.txt_plain));
  }

  // 13. list page loads
  const r3 = await p.goto('http://127.0.0.1:8901/admin/matrikskhas', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  check('CM13. custom module list loads', r3.status() === 200, 'status=' + r3.status());

  console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
  if (failures.length) console.log('FAILURES:\n  ' + failures.join('\n  '));
  if (pageErrors.length) console.log('PAGE ERRORS: ' + pageErrors.slice(0, 3).join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(2); });
