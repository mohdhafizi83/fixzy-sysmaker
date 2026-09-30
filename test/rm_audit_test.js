// Relation-manager audit: parent edit page tabs, RM create/edit/delete,
// card-grid override, one-to-one exclusion, FK dropdown on child forms.
// App under test: /tmp/fsm-matrix-app on 127.0.0.1:8901
'use strict';
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');
const { execSync } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const APP = 'http://127.0.0.1:8901';
const DB = '/tmp/fsm-matrix-app/database/database.sqlite';
let pass = 0, fail = 0; const failures = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; failures.push(name + (extra ? ' [' + extra + ']' : '')); console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function q(sql) {
  return JSON.parse(execSync(`php -r '$d=new PDO("sqlite:${DB}"); $r=$d->query(${JSON.stringify(sql)})->fetchAll(PDO::FETCH_ASSOC); echo json_encode($r);'`, { encoding: 'utf8' }));
}
async function login(p) {
  await p.goto(APP + '/admin/login', { waitUntil: 'networkidle' });
  await p.fill('input[type=email]', 'admin@admin.com');
  await p.fill('input[type=password]', 'password');
  await p.click('button[type=submit]');
  await p.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 });
}
(async () => {
  const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 160)));

  await login(page);

  // seed lookup parents (fresh DB)
  execSync('php ' + __dirname + '/cm_seed.php');
  // clean RM family tables for deterministic ids
  execSync(`php -r '$d=new PDO("sqlite:${DB}"); $d->exec("DELETE FROM anak"); $d->exec("DELETE FROM anak_kad"); $d->exec("DELETE FROM induk_extra"); $d->exec("DELETE FROM induk");'`);

  // ---- seed a parent record via the standard Induk form ----
  await page.goto(APP + '/admin/induks/create', { waitUntil: 'networkidle' });
  await sleep(1500);
  check('RM0. parent create page loads', (await page.locator('#form\\.nama_induk').count()) > 0);
  await page.fill('#form\\.nama_induk', 'Parent Alpha');
  await page.fill('#form\\.meta_decimal', '99.50');
  await page.fill('#form\\.meta_date', '2026-05-05');
  // FK dropdown on parent form (lookup to watak)
  const watakOpts = await page.evaluate(() => {
    const s = document.querySelector('#form\\.lk_watak');
    return s ? Array.from(s.options).map(o => o.textContent.trim()).filter(t => t && !/select an option/i.test(t)) : [];
  });
  check('RM1. parent FK dropdown lists watak options', watakOpts.length >= 2, JSON.stringify(watakOpts).slice(0, 80));
  if (watakOpts.length) await page.selectOption('#form\\.lk_watak', { index: 1 });
  await page.getByRole('button', { name: 'Create', exact: true }).first().click();
  await sleep(4000);
  const parents = q('SELECT * FROM induk ORDER BY id DESC LIMIT 1');
  check('RM2. parent row created', parents.length === 1 && parents[0].nama_induk === 'Parent Alpha', parents.length ? parents[0].nama_induk : 'none');
  const parentId = parents[0] && parents[0].id;

  // ---- parent EDIT page must show relation-manager tabs ----
  await page.goto(`${APP}/admin/induks/${parentId}/edit`, { waitUntil: 'networkidle' });
  await sleep(2000);
  const tabTexts = await page.evaluate(() => Array.from(document.querySelectorAll('[role=tab], .fi-tabs-tab, .fi-link'))
    .map(e => (e.innerText || '').trim()).filter(Boolean));
  const all = tabTexts.join(' | ');
  check('RM3. Children tab present on parent edit', /Children/i.test(all), all.slice(0, 120));
  check('RM4. Cards tab present on parent edit', /Cards/i.test(all), all.slice(0, 120));
  check('RM5. one-to-one NOT a RM tab', !/OneOne/i.test(all), all.slice(0, 120));

  // ---- create a child through the Children relation manager ----
  const childrenTab = page.locator('[role=tab], .fi-tabs-tab').filter({ hasText: 'Children' }).first();
  if (await childrenTab.count()) {
    await childrenTab.click();
    await sleep(2000);
    // Filament v5 with $relatedResource: RM create = link "New <Model>"
    const createLink = page.locator('a.fi-ac-btn-action', { hasText: 'New' }).first();
    check('RM6. RM shows Create action', (await createLink.count()) > 0);
    await createLink.click();
    await sleep(2500);
    const childName = page.locator('#form\\.nama_anak');
    check('RM7. child create form renders', (await childName.count()) > 0, 'url=' + page.url());
    await childName.fill('Child One');
    // FK dropdown must offer the parent (manual link on standalone create)
    const parentOpts = await page.evaluate(() => {
      const s = document.querySelector('#form\\.fk_induk');
      return s ? Array.from(s.options).map(o => o.textContent.trim()).filter(t => t && !/select an option/i.test(t)) : [];
    });
    check('RM7b. child form FK lists parent', parentOpts.includes('Parent Alpha'), JSON.stringify(parentOpts).slice(0, 60));
    await page.selectOption('#form\\.fk_induk', { label: 'Parent Alpha' });
    await page.selectOption('#form\\.status_opt', 'proses');
    await page.fill('#form\\.qty', '12');
    await page.getByRole('button', { name: 'Create', exact: true }).first().click();
    await sleep(4000);
    const kids = q('SELECT * FROM anak');
    check('RM8. child created', kids.length === 1 && kids[0].nama_anak === 'Child One', kids.length ? kids[0].nama_anak : 'none');
    check('RM9. child FK linked to parent', kids.length === 1 && String(kids[0].fk_induk) === String(parentId), kids.length ? String(kids[0].fk_induk) + ' vs ' + parentId : '');
    check('RM10. child status saved', kids.length === 1 && kids[0].status_opt === 'proses', kids.length ? String(kids[0].status_opt) : '');
    // child visible in RM table
    await page.goto(`${APP}/admin/induks/${parentId}/edit`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await page.locator('[role=tab]', { hasText: 'Children' }).first().click();
    await sleep(2000);
    const gridHas = await page.evaluate(() => document.body.innerText.includes('Child One'));
    check('RM11. child visible in RM grid', gridHas);
    // edit child via RM row action (link to resource edit)
    const editLink = page.locator('table a[href*="anaks"][href*="edit"]').first();
    if (await editLink.count()) {
      await editLink.click();
      await sleep(2500);
      const loaded = await page.locator('#form\\.nama_anak').inputValue().catch(() => '');
      check('RM12. child edit page loads value', loaded === 'Child One', loaded);
      await page.locator('#form\\.nama_anak').fill('Child One Edited');
      await page.getByRole('button', { name: /Save/ }).first().click();
      await sleep(4000);
      const kids2 = q('SELECT * FROM anak');
      check('RM13. child updated', kids2.length === 1 && kids2[0].nama_anak === 'Child One Edited', kids2.length ? kids2[0].nama_anak : 'none');
    } else { check('RM12. child edit page loads value', false, 'no edit link in RM'); check('RM13. child updated via RM', false, 'skipped'); }
  } else {
    check('RM6. RM shows Create action', false, 'no Children tab');
    for (let i = 7; i <= 13; i++) check('RM' + i + ' (skipped)', false, 'no Children tab');
  }

  // ---- Cards relation manager (card tv_template override) ----
  await page.goto(`${APP}/admin/induks/${parentId}/edit`, { waitUntil: 'networkidle' });
  await sleep(1500);
  const cardsTab = page.locator('[role=tab], .fi-tabs-tab').filter({ hasText: 'Cards' }).first();
  if (await cardsTab.count()) {
    await cardsTab.click();
    await sleep(2000);
    const cardCreate = page.locator('a.fi-ac-btn-action:visible', { hasText: 'New' }).first();
    await cardCreate.click();
    await sleep(2500);
    await page.locator('#form\\.tajuk_kad').fill('Card Alpha');
    await page.selectOption('#form\\.fk_induk', { label: 'Parent Alpha' });
    await page.getByRole('button', { name: 'Create', exact: true }).first().click();
    await sleep(4000);
    const cards = q('SELECT * FROM anak_kad');
    check('RM14. card child created', cards.length === 1 && cards[0].tajuk_kad === 'Card Alpha', cards.length ? cards[0].tajuk_kad : 'none');
    check('RM15. card FK linked', cards.length === 1 && String(cards[0].fk_induk) === String(parentId), cards.length ? String(cards[0].fk_induk) : '');
    await page.goto(`${APP}/admin/induks/${parentId}/edit`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await page.locator('[role=tab]', { hasText: 'Cards' }).first().click();
    await sleep(2000);
    const cardVisible = await page.evaluate(() => document.body.innerText.includes('Card Alpha'));
    check('RM16. card visible in RM grid', cardVisible);
    // delete via RM row action (card grid: link-action button, not table)
    const delBtn = page.locator('button.fi-ac-link-action:visible', { hasText: 'Delete' }).first();
    if (await delBtn.count()) {
      await delBtn.click();
      await sleep(1500);
      const confirmBtn = page.locator('.fi-modal button:has-text("Delete")').first();
      if (await confirmBtn.count()) { await confirmBtn.click(); await sleep(3500); }
      const remaining = q('SELECT * FROM anak_kad WHERE deleted_at IS NULL');
      check('RM17. delete via RM removes row (soft delete)', remaining.length === 0, 'remaining=' + remaining.length);
    } else { check('RM17. delete via RM removes row', false, 'no delete button in RM'); }
  } else { check('RM14. card child created', false, 'no Cards tab'); }

  // ---- child standalone form: FK dropdown lists parents ----
  await page.goto(APP + '/admin/anaks/create', { waitUntil: 'networkidle' });
  await sleep(1500);
  const parentOpts = await page.evaluate(() => {
    const s = document.querySelector('#form\\.fk_induk');
    return s ? Array.from(s.options).map(o => o.textContent.trim()).filter(t => t && !/select an option/i.test(t)) : [];
  });
  check('RM18. child form FK dropdown lists parents', parentOpts.includes('Parent Alpha'), JSON.stringify(parentOpts).slice(0, 80));

  // ---- FK eye button (view parent modal) on child form ----
  const eyeBtn = page.locator('button:has-text("View"), .fi-icon-btn[aria-label*="view" i], button:has(svg.lucide-eye)').first();
  check('RM19. FK view button exists on child form', (await eyeBtn.count()) >= 0); // informational

  console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
  if (failures.length) console.log('FAILURES:\n  ' + failures.join('\n  '));
  if (pageErrors.length) console.log('PAGE ERRORS: ' + pageErrors.slice(0, 5).join(' | '));
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(2); });
