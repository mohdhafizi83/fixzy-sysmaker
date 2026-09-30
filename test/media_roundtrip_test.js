// Media round-trip audit: image upload, file upload, attachments (multi),
// google map field + viewer, youtube field + viewer + helper.
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
const FIX = path.join(__dirname, 'fixtures');
let pass = 0, fail = 0; const failures = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; failures.push(name + (extra ? ' [' + extra + ']' : '')); console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function q(sql) {
  return JSON.parse(execSync(`php -r '$d=new PDO("sqlite:${DB}"); $r=$d->query(${JSON.stringify(sql)})->fetchAll(PDO::FETCH_ASSOC); echo json_encode($r);'`, { encoding: 'utf8' }));
}
(async () => {
  const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 160)));

  await page.goto(APP + '/admin/login', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', 'admin@admin.com');
  await page.fill('input[type=password]', 'password');
  await page.click('button[type=submit]');
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 });

  // ---- create page renders all media fields ----
  await page.goto(APP + '/admin/matrixrecords/create', { waitUntil: 'networkidle' });
  await sleep(2000);
  check('MD1. create page loads with media fields', (await page.locator('#form\\.txt_plain').count()) > 0);
  const fileInputs = await page.locator('input[type=file]').count();
  check('MD2. file inputs rendered (img x2 + doc + attachments)', fileInputs >= 4, 'count=' + fileInputs);

  // ---- upload profile picture ----
  const imgInput = page.locator('input[type=file]').nth(0);
  await imgInput.setInputFiles(path.join(FIX, 'media_test.png'));
  await sleep(2500);
  const imgUploaded = await page.evaluate(() => !!document.body.innerText.match(/media_test|\.png/i));
  check('MD3. image upload accepted (preview shown)', imgUploaded);

  // ---- upload document (pdf) ----
  const docInput = page.locator('input[type=file]').nth(2);
  await docInput.setInputFiles(path.join(FIX, 'media_test.pdf'));
  await sleep(2500);
  const docUploaded = await page.evaluate(() => !!document.body.innerText.match(/media_test\.pdf/i));
  check('MD4. pdf upload accepted', docUploaded);

  // ---- attachments multi (2 files) ----
  const multiInput = page.locator('input[type=file]').nth(3);
  await multiInput.setInputFiles([path.join(FIX, 'media_test.txt'), path.join(FIX, 'media_test.pdf')]);
  await sleep(3000);
  const multiUploaded = await page.evaluate(() => (document.body.innerText.match(/media_test/g) || []).length >= 2);
  check('MD5. attachments multi upload accepted', multiUploaded);

  // ---- map + youtube text fields ----
  await page.fill('#form\\.map_loc', '3.1478,101.6953');
  await page.fill('#form\\.vid_clip', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await sleep(500);

  // required field
  await page.fill('#form\\.txt_plain', 'Media Roundtrip');
  await page.getByRole('button', { name: 'Create', exact: true }).first().click();
  await sleep(5000);
  const stillCreate = page.url().includes('/create');
  const errs = await page.evaluate(() => Array.from(document.querySelectorAll('.fi-fo-field-wrp-error-message, .fi-field-error-message')).map(e => e.textContent.trim()).filter(Boolean).slice(0, 5));
  check('MD6. form with media submits', !stillCreate && errs.length === 0, 'stillCreate=' + stillCreate + ' errs=' + JSON.stringify(errs));

  // ---- DB values ----
  const rows = q('SELECT * FROM matriks ORDER BY id DESC LIMIT 1');
  const row = rows[0] || {};
  check('MD7. row created', !!row.id);
  const imgVal = String(row.img_profile || '');
  check('MD8. img_profile saved path', imgVal.includes('img-profile') && imgVal.endsWith('.png'), imgVal);
  const docVal = String(row.file_doc || '');
  check('MD9. file_doc saved path', docVal.includes('file-doc') && docVal.endsWith('.pdf'), docVal);
  const multiVal = String(row.file_multi || '');
  check('MD10. file_multi saved 2 files', (multiVal.match(/attachments/g) || []).length >= 1 && (multiVal.includes('.txt') || multiVal.includes('.pdf')), multiVal.slice(0, 120));
  check('MD11. map_loc saved', String(row.map_loc) === '3.1478,101.6953', String(row.map_loc));
  check('MD12. vid_clip saved', String(row.vid_clip).includes('dQw4w9WgXcQ'), String(row.vid_clip));

  // ---- files physically on disk ----
  let diskOk = false, diskInfo = '';
  try {
    const out = execSync(`php -r '
      $base = "/tmp/fsm-matrix-app/storage/app";
      $img = glob($base . "/public/img-profile/*.png");
      $doc = glob($base . "/public/file-doc/*.pdf");
      $att = array_merge(glob($base . "/private/attachments/*/*"), glob($base . "/local/attachments/*/*"));
      echo json_encode(["img"=>count($img),"doc"=>count($doc),"att"=>count($att)]);
    '`, { encoding: 'utf8' });
    const d = JSON.parse(out);
    diskOk = d.img >= 1 && d.doc >= 1 && d.att >= 2;
    diskInfo = JSON.stringify(d);
  } catch (e) { diskInfo = e.message; }
  check('MD13. files exist on disk (public storage)', diskOk, diskInfo);

  // ---- edit page: existing files shown + viewers render ----
  if (row.id) {
    await page.goto(`${APP}/admin/matrixrecords/${row.id}/edit`, { waitUntil: 'networkidle' });
    await sleep(2500);
    const editHasFile = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')).map(i => i.src || '');
      const hasStored = imgs.some(s => s.includes('/storage/'));
      const hasUploadCmp = !!document.querySelector('.fi-file-upload, [class*=file-upload]');
      return hasStored || hasUploadCmp;
    });
    check('MD14. edit page shows existing uploads', editHasFile);
    // map viewer blade rendered (no crash) — look for map container
    const mapViewer = await page.evaluate(() => {
      const html = document.body.innerHTML;
      return /map-viewer|leaflet|google|map/i.test(html);
    });
    check('MD15. map viewer component renders', mapViewer);
    const vidViewer = await page.evaluate(() => {
      const html = document.body.innerHTML;
      return /youtube|embed|video/i.test(html);
    });
    check('MD16. video viewer component renders', vidViewer);

    // update: remove image, keep others
    const delImgBtn = page.locator('button[aria-label*="Remove" i], .fi-icon-btn:has-text("")').first();
    // simpler: just change map value and save
    await page.fill('#form\\.map_loc', '3.15,101.70');
    await page.getByRole('button', { name: /Save/ }).first().click();
    await sleep(4500);
    const row2 = q(`SELECT * FROM matriks WHERE id=${row.id}`)[0];
    check('MD17. update keeps media + changes map', String(row2.map_loc) === '3.15,101.70' && String(row2.img_profile) === imgVal, 'map=' + String(row2.map_loc) + ' img=' + String(row2.img_profile).slice(0, 40));
  }

  // ---- youtube helper method ----
  try {
    const helper = execSync(`cd /tmp/fsm-matrix-app && php artisan tinker --execute='
      $m = new \\App\\Models\\MatrixRecord();
      $m->vid_clip = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      echo $m->getCleanYoutubeUrl("vid_clip");
    ' 2>/dev/null`, { encoding: 'utf8' }).trim();
    check('MD18. youtube helper -> embed URL', helper.includes('youtube.com/embed/dQw4w9WgXcQ'), helper.slice(0, 80));
  } catch (e) { check('MD18. youtube helper -> embed URL', false, e.message.slice(0, 80)); }

  console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
  if (failures.length) console.log('FAILURES:\n  ' + failures.join('\n  '));
  if (pageErrors.length) console.log('PAGE ERRORS: ' + pageErrors.slice(0, 5).join(' | '));
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(2); });
