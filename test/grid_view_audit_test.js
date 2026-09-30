// Grid-view audit: table<->card switcher, inline edit, summary row, kanban
// drag-drop + transition guard, calendar page, tree page, custom-module
// column overrides, RM grid media columns.
// App under test: /tmp/fsm-matrix-app on 127.0.0.1:8901
'use strict';
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const APP = 'http://127.0.0.1:8901';
const DB = '/tmp/fsm-matrix-app/database/database.sqlite';
const APPDIR = '/tmp/fsm-matrix-app';
let pass = 0, fail = 0; const failures = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; failures.push(name + (extra ? ' [' + extra + ']' : '')); console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function q(sql) {
  const code = `$d=new PDO("sqlite:${DB}"); $r=$d->query(${JSON.stringify(sql)})->fetchAll(PDO::FETCH_ASSOC); echo json_encode($r);`;
  const quoted = code.replace(/'/g, "'\\''");
  return JSON.parse(execSync(`php -r '${quoted}'`, { encoding: 'utf8' }));
}
function php(code) {
  const f = '/tmp/fsm_grid_seed.php';
  fs.writeFileSync(f, `<?php
require '${APPDIR}/vendor/autoload.php';
$app = require '${APPDIR}/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
${code}
`);
  return execSync(`php ${f} 2>&1`, { encoding: 'utf8' }).trim();
}
(async () => {
  // ---- seed: 3 matrix rows across kanban statuses + pokok hierarchy ----
  execSync(`mkdir -p ${APPDIR}/storage/app/public/img-profile && cp ${path.join(__dirname, 'fixtures', 'media_test.png')} ${APPDIR}/storage/app/public/img-profile/seed1.png`, { stdio: 'ignore' });
  php(`
    \\App\\Models\\MatrixRecord::truncate();
    \\App\\Models\\MatrixRecord::create(['txt_plain'=>'Alpha One','opt_dropdown'=>'satu','num_int'=>10,'num_decimal'=>1.5,'dt_date'=>'2026-10-05','dt_datetime'=>'2026-10-06 09:00:00','img_profile'=>'img-profile/seed1.png']);
    \\App\\Models\\MatrixRecord::create(['txt_plain'=>'Bravo Two','opt_dropdown'=>'dua','num_int'=>20,'num_decimal'=>2.5,'dt_date'=>'2026-10-12','dt_datetime'=>'2026-10-13 09:00:00']);
    \\App\\Models\\MatrixRecord::create(['txt_plain'=>'Charlie Three','opt_dropdown'=>'tiga','num_int'=>30,'num_decimal'=>3.5,'dt_date'=>'2026-10-20','dt_datetime'=>'2026-10-21 09:00:00']);
    \\App\\Models\\MatrixRecord::create(['txt_plain'=>'DragTest','opt_dropdown'=>'satu','num_int'=>9,'dt_date'=>'2026-10-08','dt_datetime'=>'2026-10-09 09:00:00']);
    \\App\\Models\\Pokok::truncate();
    $root = \\App\\Models\\Pokok::create(['nama_pokok'=>'Root Node']);
    \\App\\Models\\Pokok::create(['nama_pokok'=>'Child Alpha','parent_id'=>$root->id]);
    \\App\\Models\\Pokok::create(['nama_pokok'=>'Child Beta','parent_id'=>$root->id]);
    $p = \\App\\Models\\Induk::create(['nama_induk'=>'Grid Parent']);
    \\App\\Models\\Anak::create(['nama_anak'=>'RM Grid Kid','fk_induk'=>$p->id,'status_opt'=>'baru']);
    echo "seeded";
  `);

  const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 160)));

  await page.goto(APP + '/admin/login', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', 'admin@admin.com');
  await page.fill('input[type=password]', 'password');
  await page.click('button[type=submit]');
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 });

  // ---- GV1: matrix list DEFAULT = card view ----
  await page.goto(APP + '/admin/matrixrecords', { waitUntil: 'networkidle' });
  await sleep(2500);
  const cardGrid = await page.evaluate(() => {
    const grid = document.querySelector('[class*="grid-cols"]');
    const inputs = Array.from(document.querySelectorAll('input[type=text]')).map(i => i.value).join(' ');
    return !!grid && /Alpha One/.test(inputs);
  });
  check('GV1. list defaults to CARD view (grid layout + rows visible)', cardGrid);
  const tableToggle = page.locator('a:has-text("Table view")').first();
  check('GV2. "Table view" toggle link present', (await tableToggle.count()) > 0);

  // ---- GV3: switch to table view ----
  await tableToggle.click();
  await sleep(2500);
  const isTable = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('table input[type=text]')).map(i => i.value).join(' ');
    return !!document.querySelector('table') && /Alpha One/.test(inputs);
  });
  check('GV3. ?view=table renders TABLE layout', isTable, 'url=' + page.url());
  const cardToggle = page.locator('a:has-text("Card view")').first();
  check('GV4. "Card view" toggle link present in table mode', (await cardToggle.count()) > 0);

  // ---- GV5: summary row ----
  const summary = await page.evaluate(() => {
    const t = document.body.innerText;
    return { sum: /Total Integer/.test(t), avg: /Average Decimal/.test(t) };
  });
  check('GV5. summary row shows Sum + Average', summary.sum && summary.avg, JSON.stringify(summary));

  // ---- GV6: inline edit txt_plain in table ----
  const inlineInput = page.locator('table input[type=text]').first();
  if (await inlineInput.count()) {
    await inlineInput.fill('Alpha Edited');
    await inlineInput.press('Tab');
    await sleep(3000);
    const v = q("SELECT txt_plain FROM matriks WHERE id=1")[0];
    check('GV6. inline edit persists to DB', v && v.txt_plain === 'Alpha Edited', v ? v.txt_plain : 'none');
  } else { check('GV6. inline edit persists to DB', false, 'no inline input in table'); }

  // ---- GV7: kanban board columns ----
  await page.goto(APP + '/admin/matrikspapans-board', { waitUntil: 'networkidle' });
  await sleep(2500);
  const kanbanCols = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('[data-status]'));
    return cols.map(c => c.dataset.status);
  });
  check('GV7. kanban shows 3 status columns', kanbanCols.length >= 3 && ['satu', 'dua', 'tiga'].every(s => kanbanCols.includes(s)), JSON.stringify(kanbanCols));
  const cardCount = await page.locator('.fz-kb-card').count();
  check('GV8. kanban renders cards', cardCount >= 3, 'cards=' + cardCount);

  // ---- GV9: drag DragTest card satu -> dua (allowed) ----
  const dragCard = page.locator('.fz-kb-card', { hasText: 'DragTest' }).first();
  const duaCol = page.locator('[data-status="dua"]').first();
  if (await dragCard.count() && await duaCol.count()) {
    await dragCard.dragTo(duaCol);
    await sleep(3000);
    const row = q("SELECT opt_dropdown FROM matriks WHERE txt_plain='DragTest'")[0];
    check('GV9. drag satu->dua persists', row && row.opt_dropdown === 'dua', row ? row.opt_dropdown : 'none');
  } else { check('GV9. drag satu->dua persists', false, 'card/col missing'); }

  // ---- GV10: invalid transition tiga -> satu blocked (tiga has no
  // allowed outgoing moves in the configured transition map) ----
  if (await dragCard.count()) {
    // first move DragTest to tiga via allowed dua->tiga
    const tigaCol = page.locator('[data-status="tiga"]').first();
    await dragCard.dragTo(tigaCol);
    await sleep(3000);
    const mid = q("SELECT opt_dropdown FROM matriks WHERE txt_plain='DragTest'")[0];
    if (mid && mid.opt_dropdown === 'tiga') {
      const satuCol = page.locator('[data-status="satu"]').first();
      await dragCard.dragTo(satuCol);
      await sleep(3000);
      const row2 = q("SELECT opt_dropdown FROM matriks WHERE txt_plain='DragTest'")[0];
      check('GV10. invalid transition tiga->satu blocked', row2 && row2.opt_dropdown === 'tiga', row2 ? row2.opt_dropdown : 'none');
    } else { check('GV10. invalid transition tiga->satu blocked', false, 'setup move failed: ' + (mid ? mid.opt_dropdown : 'none')); }
  } else { check('GV10. invalid transition tiga->satu blocked', false, 'card missing'); }

  // ---- GV11: calendar page (navigate to October where events live) ----
  await page.goto(APP + '/admin/matrikspapans-calendar', { waitUntil: 'networkidle' });
  await sleep(2500);
  const cal0 = await page.evaluate(() => document.querySelector('.fi-main-ctn, main').innerText.slice(0, 80));
  check('GV11a. calendar renders month grid', /2026/.test(cal0), cal0.slice(0, 60));
  await page.locator('button:has-text("Next"), a:has-text("Next")').first().click();
  await sleep(2500);
  const cal = await page.evaluate(() => {
    const t = document.querySelector('.fi-main-ctn, main').innerText;
    return { hasOct: /October/i.test(t), hasEvent: /Alpha|Bravo|Charlie|DragTest/.test(t) };
  });
  check('GV11. calendar shows October events', cal.hasOct && cal.hasEvent, JSON.stringify(cal));

  // ---- GV12: tree page ----
  await page.goto(APP + '/admin/pokoks-tree', { waitUntil: 'networkidle' });
  await sleep(2500);
  const tree = await page.evaluate(() => {
    const t = document.body.innerText;
    return { root: /Root Node/.test(t), child: /Child Alpha/.test(t) && /Child Beta/.test(t) };
  });
  check('GV12. tree renders hierarchy', tree.root && tree.child, JSON.stringify(tree));

  // ---- GV13: custom module MatriksKhas hides lk_dropdown column ----
  await page.goto(APP + '/admin/matrikskhas', { waitUntil: 'networkidle' });
  await sleep(2500);
  const khas = await page.evaluate(() => {
    const heads = Array.from(document.querySelectorAll('table th')).map(h => h.innerText.trim());
    const inputs = Array.from(document.querySelectorAll('table input[type=text]')).map(i => i.value).join(' ');
    return { heads: heads.join('|'), hasAlpha: /Alpha/.test(inputs) || /Alpha/.test(document.body.innerText) };
  });
  check('GV13. MatriksKhas list loads rows', khas.hasAlpha, 'heads=' + khas.heads.slice(0, 100));
  check('GV14. MatriksKhas hides Lookup Dropdown column (hide_in_tv)', !/Lookup Dropdown/i.test(khas.heads), khas.heads.slice(0, 140));

  // ---- GV15: RM grid shows media columns (image thumb + upload icon) ----
  const parentId = q('SELECT id FROM induk ORDER BY id DESC LIMIT 1')[0];
  if (parentId) {
    // give the existing RM child a photo + doc so the grid has media to show
    php(`
      $c = \\App\\Models\\Anak::latest('id')->first();
      if ($c) { $c->child_photo = 'img-profile/seed1.png'; $c->child_doc = 'file-doc/seed.pdf'; $c->save(); }
    `);
    execSync(`mkdir -p ${APPDIR}/storage/app/public/file-doc && cp ${path.join(__dirname, 'fixtures', 'media_test.pdf')} ${APPDIR}/storage/app/public/file-doc/seed.pdf`, { stdio: 'ignore' });
    await page.goto(`${APP}/admin/induks/${parentId.id}/edit`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await page.locator('[role=tab]', { hasText: 'Children' }).first().click();
    await sleep(2500);
    const rmGrid = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('table img, .fi-ta-ctn img')).map(i => i.src || '');
      const icons = Array.from(document.querySelectorAll('table svg, .fi-ta-ctn svg')).length;
      return { imgCount: imgs.filter(s => s.includes('storage')).length, icons };
    });
    check('GV15. RM grid renders image column', rmGrid.imgCount >= 1, JSON.stringify(rmGrid));
    check('GV16. RM grid renders icon columns (upload etc)', rmGrid.icons >= 1, 'icons=' + rmGrid.icons);
  } else {
    check('GV15. RM grid renders image column', false, 'no parent row');
    check('GV16. RM grid renders icon columns (upload etc)', false, 'no parent row');
  }

  console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
  if (failures.length) console.log('FAILURES:\n  ' + failures.join('\n  '));
  if (pageErrors.length) console.log('PAGE ERRORS: ' + pageErrors.slice(0, 5).join(' | '));
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(2); });
