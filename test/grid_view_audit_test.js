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
    \\App\\Models\\MatrixRecord::create(['txt_plain'=>'Alpha One','opt_dropdown'=>'satu','num_int'=>10,'num_decimal'=>1.5,'dt_date'=>'2026-10-05','dt_datetime'=>'2026-10-06 09:00:00','img_profile'=>'img-profile/seed1.png','img_avatar'=>'img-profile/seed1.png','file_doc'=>'file-doc/seed.pdf','map_loc'=>'<iframe src=\"https://maps.google.com/maps?q=KL&output=embed\" width=\"600\" height=\"450\"></iframe>','vid_clip'=>'https://www.youtube.com/watch?v=dQw4w9WgXcQ','bool_check'=>1,'txt_email'=>'a@b.com','txt_url'=>'https://fixzy.test','txt_tel'=>'0123456789','color_hex'=>'#ff0000']);
    \\App\\Models\\MatrixRecord::create(['txt_plain'=>'Bravo Two','opt_dropdown'=>'dua','num_int'=>20,'num_decimal'=>2.5,'dt_date'=>'2026-10-12','dt_datetime'=>'2026-10-13 09:00:00','color_hex'=>'#00ff00']);
    \\App\\Models\\MatrixRecord::create(['txt_plain'=>'Charlie Three','opt_dropdown'=>'tiga','num_int'=>30,'num_decimal'=>3.5,'dt_date'=>'2026-10-20','dt_datetime'=>'2026-10-21 09:00:00','color_hex'=>'#0000ff']);
    \\App\\Models\\MatrixRecord::create(['txt_plain'=>'DragTest','opt_dropdown'=>'satu','num_int'=>9,'dt_date'=>'2026-10-08','dt_datetime'=>'2026-10-09 09:00:00','color_hex'=>'#ff0000']);
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

  // ================= tv_* per-variable visual sweep =================
  // (table view of the standard module — every column rule asserted from
  // the variable set on the field, per grid audit round 2, 2026-09-30)
  await page.goto(APP + '/admin/matrixrecords?view=table', { waitUntil: 'networkidle' });
  await sleep(2500);

  // helper: find the td for a column by header text, return inner element facts
  async function cellInfo(headerText, rowText) {
    return page.evaluate(({ headerText, rowText }) => {
      const ths = Array.from(document.querySelectorAll('table thead th'));
      const idx = ths.findIndex(h => (h.innerText || '').trim().toLowerCase().includes(headerText.toLowerCase()));
      if (idx < 0) return null;
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const row = rows.find(r => {
        const t = (r.innerText || '');
        if (t.includes(rowText)) return true;
        // inline-edit columns hold values in <input>, not innerText
        return Array.from(r.querySelectorAll('input[type=text]')).some(i => (i.value || '').includes(rowText));
      });
      if (!row) return null;
      const td = row.children[idx];
      if (!td) return null;
      // Filament v5: text -> .fi-ta-text-item, icon -> .fi-ta-icon, image -> img
      const textEl = td.querySelector('.fi-ta-text-item');
      const iconEl = td.querySelector('.fi-ta-icon');
      const imgEl = td.querySelector('img');
      const cs = textEl ? getComputedStyle(textEl) : null;
      const ics = iconEl ? getComputedStyle(iconEl) : null;
      return {
        text: (td.innerText || '').trim(),
        hasText: !!textEl,
        fontWeight: cs ? cs.fontWeight : null,
        fontSize: cs ? cs.fontSize : null,
        textAlign: cs ? (cs.textAlign || cs.getPropertyValue('text-align')) : null,
        hasIcon: !!iconEl,
        iconColor: ics ? ics.color : null,
        iconMask: ics ? (ics.maskImage || ics.webkitMaskImage || '') : '',
        imgSrc: imgEl ? imgEl.src : null,
        imgRadius: imgEl ? getComputedStyle(imgEl).borderRadius : null,
        imgW: imgEl ? imgEl.width : null,
      };
    }, { headerText, rowText });
  }

  // GV17: tv_font_weight Bold on txt_email
  const cEmail = await cellInfo('Email', 'Alpha');
  check('GV17. tv_font_weight=Bold applies (txt_email)', cEmail && (cEmail.fontWeight === '700' || cEmail.fontWeight === 'bold'), cEmail ? cEmail.fontWeight : 'no cell');

  // GV18: tv_text_size=Large on txt_url
  const cUrl = await cellInfo('URL', 'Alpha');
  check('GV18. tv_text_size=Large applies (txt_url)', cUrl && parseFloat(cUrl.fontSize) >= 16, cUrl ? cUrl.fontSize : 'no cell');

  // GV19: tv_alignment=center on txt_url
  check('GV19. tv_alignment=center applies (txt_url)', cUrl && /center/.test(cUrl.textAlign), cUrl ? cUrl.textAlign : 'no cell');

  // GV20: tv_text_limit=8 truncates txt_tel with (more)
  const cTel = await cellInfo('Telephone', 'Alpha');
  check('GV20. tv_text_limit truncates with (more) (txt_tel)', cTel && /\(more\)/.test(cTel.text) && !/0123456789$/.test(cTel.text), cTel ? cTel.text : 'no cell');

  // GV21: tv_currency_code on num_int -> money format (RM)
  const cInt = await cellInfo('Integer', 'Alpha');
  check('GV21. tv_currency_code formats money (num_int)', cInt && /RM|MYR/.test(cInt.text), cInt ? cInt.text : 'no cell');

  // GV22: image column renders img (img_profile)
  const cImg = await cellInfo('Profile Picture', 'Alpha');
  check('GV22. image column renders img (img_profile)', cImg && !!cImg.imgSrc && cImg.imgSrc.includes('seed1.png'), cImg ? String(cImg.imgSrc).slice(0, 60) : 'no cell');

  // GV23: tv_thumb_shape circular (img_avatar) vs square (img_profile)
  const cAva = await cellInfo('Avatar Circular', 'Alpha');
  const round = cAva && cAva.imgRadius && (parseFloat(cAva.imgRadius) >= 999 || /9999|50%/.test(cAva.imgRadius));
  const square = cImg && cImg.imgRadius && parseFloat(cImg.imgRadius) < 10;
  check('GV23. tv_thumb_shape circular vs square', !!round && !!square, 'ava=' + (cAva ? cAva.imgRadius : 'none') + ' prof=' + (cImg ? cImg.imgRadius : 'none'));

  // GV24: tv_thumb_width honored (40px)
  check('GV24. tv_thumb_width=40 applies (img_avatar)', cAva && cAva.imgW === 40, cAva ? String(cAva.imgW) : 'none');

  // GV25: gmap icon column present (map_loc)
  const cMap = await cellInfo('Location Map', 'Alpha');
  check('GV25. gmap icon column present (map_loc)', cMap && cMap.hasIcon, cMap ? 'icon=' + cMap.hasIcon : 'no cell');

  // GV26: youtube icon column present
  const cVid = await cellInfo('Video Clip', 'Alpha');
  check('GV26. youtube icon column present (vid_clip)', cVid && cVid.hasIcon, cVid ? 'icon=' + cVid.hasIcon : 'no cell');

  // GV27: boolean column renders icon (bool_check)
  const cBool = await cellInfo('Checkbox', 'Alpha');
  check('GV27. boolean icon column present (bool_check)', cBool && cBool.hasIcon, cBool ? 'icon=' + cBool.hasIcon : 'no cell');

  // GV28: sortable column — click header reorders
  const before = await page.evaluate(() => Array.from(document.querySelectorAll('table tbody tr')).map(r => r.innerText.split('\n')[0]).slice(0, 3).join(','));
  const idHeader = page.locator('table thead th', { hasText: 'ID' }).first();
  const sortBtn = idHeader.locator('button, a').first();
  if (await sortBtn.count()) {
    await sortBtn.click();
    await sleep(2500);
    const after = await page.evaluate(() => Array.from(document.querySelectorAll('table tbody tr')).map(r => r.innerText.split('\n')[0]).slice(0, 3).join(','));
    check('GV28. allow_sorting sorts on header click', before !== after, 'before=' + before + ' after=' + after);
  } else { check('GV28. allow_sorting sorts on header click', false, 'no sort control on ID header'); }

  // GV29: global search filters rows
  await page.goto(APP + '/admin/matrixrecords?view=table', { waitUntil: 'networkidle' });
  await sleep(2000);
  const search = page.locator('input[type=search], .fi-global-search-input, input[placeholder*="Search" i]').first();
  if (await search.count()) {
    await search.fill('Bravo');
    await sleep(3000);
    // Robust proof the filter narrowed the dataset: the summary row
    // recomputes over the FILTERED records. All rows sum num_int=10+20+30+9=69;
    // only Bravo (20) should remain.
    const sumTxt = await page.evaluate(() => {
      const sr = document.querySelector('.fi-ta-summary-row, tr[class*=summary]');
      return sr ? sr.innerText.replace(/\s+/g, ' ') : '';
    });
    const totalMatch = sumTxt.match(/Total Integer\D+(\d+)/);
    const total = totalMatch ? parseInt(totalMatch[1], 10) : -1;
    check('GV29. global search filters dataset (summary=Bravo only, 20 not 69)', total === 20, 'summary=' + sumTxt.slice(0, 80));
  } else { check('GV29. global search filters dataset (summary=Bravo only, 20 not 69)', false, 'no search input'); }

  // GV30: calendar color_field hex applied to event chip
  await page.goto(APP + '/admin/matrikspapans-calendar', { waitUntil: 'networkidle' });
  await sleep(2000);
  await page.locator('text=Next').first().click();
  await sleep(2500);
  const chip = await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('[style*="background"]')).filter(e => {
      const bg = (e.style.background || e.style.backgroundColor || '');
      return /Alpha|Bravo|Charlie/.test(e.innerText) && !/255, 255, 255|white|#fff/i.test(bg);
    });
    return chips.slice(0, 4).map(c => ({ t: c.innerText.slice(0, 12), bg: c.style.background || c.style.backgroundColor }));
  });
  const colorOk = chip.length >= 2 && chip.some(c => /ff0000|red|255, 0, 0/i.test(c.bg)) && chip.some(c => /00ff00|0000ff|blue|green|0, 255|0, 0, 255/i.test(c.bg));
  check('GV30. calendar color_field hex applied to chips', colorOk, JSON.stringify(chip).slice(0, 140));

  console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
  if (failures.length) console.log('FAILURES:\n  ' + failures.join('\n  '));
  if (pageErrors.length) console.log('PAGE ERRORS: ' + pageErrors.slice(0, 5).join(' | '));
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(2); });
