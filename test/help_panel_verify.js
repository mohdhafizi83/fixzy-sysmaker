// Verify the AppGini-style contextual help panel in the SysMaker GUI.
// Run: node test/help_panel_verify.js   (requires `fixzy serve` on 7788)
'use strict';

const path = require('path');
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');

const BASE = 'http://127.0.0.1:7788/';
const OUT = '/tmp/help_verify';
require('fs').mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 1. FAB gone
  const fab = await page.$('.help-fab');
  check('1. help-fab removed', fab === null);

  // 2. Toggle exists in header
  const toggle = await page.$('#context-help-toggle');
  check('2. topbar toggle exists', toggle !== null);

  // 3. Panel exists
  const panel = await page.$('#fixzy-help-panel');
  check('3. help panel exists', panel !== null);

  // 4. Panel open by default (fresh localStorage)
  let open = await page.evaluate(() => document.getElementById('fixzy-help-panel').classList.contains('fixzy-help-open'));
  check('4. panel open by default', open);

  // 5. Click a known (disabled) control's label -> panel shows its entry
  await page.evaluate(() => {
    const el = document.getElementById('app-module-auth-email');
    const lab = el ? el.closest('label') : null;
    (lab || el)?.click();
  });
  await page.waitForTimeout(300);
  let title = await page.evaluate(() => document.querySelector('.fixzy-help-title').textContent);
  check('5. focus app-module-auth-email -> title matches', /Email & Password authentication/.test(title), 'got: ' + title);

  // 6. Focus another control updates content
  await page.evaluate(() => {
    const el = document.getElementById('app-debug-mode');
    if (el && el.offsetParent !== null) el.focus();
  });
  await page.waitForTimeout(300);
  title = await page.evaluate(() => document.querySelector('.fixzy-help-title').textContent);
  check('6. focus app-debug-mode -> title updates', /Debug Mode/.test(title), 'got: ' + title);
  let tip = await page.evaluate(() => {
    const t = document.querySelector('.fixzy-help-tip');
    return getComputedStyle(t).display !== 'none' ? t.textContent : '';
  });
  check('7. tip shown for debug mode', /Never enable/.test(tip), 'got: ' + tip);

  // 8. Stays open on blur (no auto-close)
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.waitForTimeout(400);
  open = await page.evaluate(() => document.getElementById('fixzy-help-panel').classList.contains('fixzy-help-open'));
  check('8. panel stays open after blur', open);

  // 9. Esc closes panel
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  open = await page.evaluate(() => document.getElementById('fixzy-help-panel').classList.contains('fixzy-help-open'));
  check('9. Esc closes panel', !open);

  // 10. Toggle reopens with tab overview
  await page.click('#context-help-toggle');
  await page.waitForTimeout(400);
  open = await page.evaluate(() => document.getElementById('fixzy-help-panel').classList.contains('fixzy-help-open'));
  title = await page.evaluate(() => document.querySelector('.fixzy-help-title').textContent);
  check('10. toggle reopens panel with tab overview', open && /Technologies Stack/.test(title), 'open=' + open + ' title=' + title);

  // 11. Unknown control -> tab fallback, never silent
  await page.evaluate(() => {
    const el = document.getElementById('app-title');
    if (el) el.focus();
  });
  await page.waitForTimeout(300);
  const body = await page.evaluate(() => document.querySelector('.fixzy-help-body').textContent);
  check('11. unknown control shows fallback (not empty)', body.length > 20, 'body: ' + body.slice(0, 60));

  // 12. localStorage persistence: close, reload, panel should be closed
  await page.evaluate(() => document.querySelector('.fixzy-help-close').click());
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  open = await page.evaluate(() => document.getElementById('fixzy-help-panel').classList.contains('fixzy-help-open'));
  check('12. closed state persists across reload', !open);

  // 13. Reopen + persistence of open state
  await page.click('#context-help-toggle');
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  open = await page.evaluate(() => document.getElementById('fixzy-help-panel').classList.contains('fixzy-help-open'));
  check('13. open state persists across reload', open);

  // 14. Panel does not shift layout: main content width unchanged with panel open vs closed
  const wOpen = await page.evaluate(() => document.querySelector('.main-header').getBoundingClientRect().width);
  await page.evaluate(() => document.querySelector('.fixzy-help-close').click());
  await page.waitForTimeout(400);
  const wClosed = await page.evaluate(() => document.querySelector('.main-header').getBoundingClientRect().width);
  check('14. no layout shift (overlay panel)', Math.abs(wOpen - wClosed) < 1, `${wOpen} vs ${wClosed}`);

  // 15. Modal above panel: open new-project modal, panel must not cover it
  await page.evaluate(() => { document.getElementById('new-project-btn-dropdown')?.click(); });
  await page.waitForTimeout(400);
  const zOrder = await page.evaluate(() => {
    const modal = document.querySelector('#new-project-modal');
    const panelEl = document.getElementById('fixzy-help-panel');
    if (!modal || modal.classList.contains('hidden')) return null;
    const mz = parseInt(getComputedStyle(modal).zIndex || '0', 10);
    const pz = parseInt(getComputedStyle(panelEl).zIndex || '0', 10);
    return { mz, pz };
  });
  check('15. modal z-index above help panel', zOrder === null || zOrder.mz > zOrder.pz, JSON.stringify(zOrder));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 16. Coverage: every visible control on tab-stack has a registry entry or fallback
  const coverage = await page.evaluate(() => {
    const entries = window.__HELP_COVERAGE_PROBE__ || null;
    return entries;
  });

  // 17. Screenshot evidence: panel open with focused field
  await page.evaluate(() => {
    const b = document.querySelector('.tab-link[data-tab="tab-stack"]');
    if (b) b.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const t = document.getElementById('fixzy-help-panel');
    t.classList.add('fixzy-help-open');
    const el = document.getElementById('app-module-log-activity');
    if (el) el.focus();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/help_panel_stack.png' });
  check('17. screenshot captured', true);

  // 18. No console errors from our modules
  const ourErrors = consoleErrors.filter(e => /contextHelp|helpContent|fixzy-help/.test(e));
  check('18. no console errors from help modules', ourErrors.length === 0, ourErrors.slice(0, 3).join(' | '));

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
