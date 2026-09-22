// S1 combined browse + test + snapshot pass.
// Captures full-page screenshots of every section/modal into docs/manual/screenshots/
// and records basic health checks (visible panel, content length, console errors).
// Run: node test/manual_snapshots.js  (requires `fixzy serve` running on 7788)
'use strict';

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:7788/';
const OUT = path.join(__dirname, '..', 'docs', 'manual', 'screenshots');
const EXE = path.join(process.env.HOME, '.cache', 'ms-playwright', 'chromium-1234', 'chrome-linux64', 'chrome');

const SECTIONS = [
  'Technologies Stack & Core features',
  'Localization',
  'Models Design',
  'Modules Setup',
  'Menu management',
  'Dashboard Builder',
  'Architecture & Multi-Tenancy',
  'Security & technical',
  'Hooks (Optional - for complex App)',
];

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', (r) => failedRequests.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(r.url() + ' [' + r.status() + ']'); });

  const results = [];
  const snap = async (name) => {
    const file = path.join(OUT, name + '.png');
    await page.screenshot({ path: file, fullPage: true });
    return file;
  };
  const clickButton = async (label) => {
    const ok = await page.evaluate((lbl) => {
      const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.trim() === lbl && x.offsetParent !== null);
      if (b) { b.click(); return true; }
      return false;
    }, label);
    await page.waitForTimeout(700);
    return ok;
  };

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // 00 — welcome modal (fresh state: no active project). If a project is already
  // active the modal may not show; capture whatever state we land on.
  await snap('00_welcome');

  // Create a project if the welcome modal is present
  const hasWelcome = await page.evaluate(() => {
    const i = document.getElementById('new-project-name');
    return !!(i && i.offsetParent !== null);
  });
  if (hasWelcome) {
    await page.fill('#new-project-name', 'QA Sweep Test 2');
    await clickButton('Create Project');
    await page.waitForTimeout(800);
    await snap('00b_tutorial_modal');
    await clickButton('OK, Got It');
    await page.waitForTimeout(400);
  }
  // Force-close ANY still-visible modal/overlay before section shots
  // (welcome/tutorial modals can reappear and obscure section content).
  await page.evaluate(() => {
    const isVisible = (el) => {
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity || '1') > 0;
    };
    document.querySelectorAll('.modal, .modal-overlay, [id*="modal"], [class*="overlay"]').forEach((m) => {
      if (isVisible(m) && !m.classList.contains('loading-overlay')) m.classList.add('hidden');
    });
  });
  await page.waitForTimeout(300);

  // 01..09 — each section, full page
  let i = 1;
  for (const sec of SECTIONS) {
    const found = await clickButton(sec);
    // measure visible content of the section panel area
    const info = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const vis = Array.from(main.querySelectorAll(':scope > div')).filter((d) => d.offsetParent !== null);
      const text = vis.map((d) => d.innerText).join('\n');
      const controls = vis.reduce((n, d) => n + d.querySelectorAll('input,select,textarea,button').length, 0);
      return { panels: vis.length, textLen: text.length, controls };
    });
    const name = `${String(i).padStart(2, '0')}_section_${slug(sec)}`;
    await snap(name);
    results.push({ item: sec, found: found && info.panels > 0 && info.textLen > 50, ...info, shot: name + '.png' });
    i++;
  }

  // Banner dropdowns + modals.
  // "Open Project" / "Import SQL" are CSS hover-dropdowns (main-menu-dropdown),
  // not click-modals — force them open via class + hover for the screenshot.
  const dropdowns = [
    ['#project-dropdown-container', '10_dropdown_open_project'],
    ['.header-actions .main-menu-dropdown:nth-of-type(2)', '11_dropdown_import_sql'],
  ];
  for (const [sel, name] of dropdowns) {
    await page.evaluate((s) => {
      const d = document.querySelector(s);
      if (d) { d.classList.add('force-open'); const c = d.querySelector('.main-menu-content'); if (c) c.style.display = 'block'; }
    }, sel);
    await page.waitForTimeout(300);
    const vis = await page.evaluate((s) => {
      const d = document.querySelector(s);
      return d ? d.innerText.trim().slice(0, 200) : '';
    }, sel);
    await snap(name);
    results.push({ item: name.replace(/^\d+_/, '').replace(/_/g, ' '), found: vis.length > 0, textLen: vis.length, shot: name + '.png' });
    await page.evaluate((s) => {
      const d = document.querySelector(s);
      if (d) { d.classList.remove('force-open'); const c = d.querySelector('.main-menu-content'); if (c) c.style.display = ''; }
    }, sel);
  }
  const modals = [
    ['Setup', '12_modal_setup_wizard'],
  ];
  // Ensure no blocking modal (welcome/tutorial) is open before banner modals.
  await page.evaluate(() => {
    const isVisible = (el) => {
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity || '1') > 0;
    };
    document.querySelectorAll('.modal, .modal-overlay, [id*="modal"]').forEach((m) => {
      if (!m.classList.contains('hidden') && isVisible(m)) {
        const c = m.querySelector('[id*="close"], .modal-close');
        if (c) c.click();
      }
    });
  });
  await page.waitForTimeout(400);
  for (const [label, name] of modals) {
    const opened = await clickButton(label);
    const vis = await page.evaluate(() => {
      // Visibility via computedStyle (offsetParent is null for position:fixed modals)
      const isVisible = (el) => {
        const s = getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity || '1') > 0;
      };
      const m = Array.from(document.querySelectorAll('.modal, .modal-overlay, [id*="modal"], [class*="modal"], dialog'))
        .filter((d) => !d.classList.contains('hidden') && isVisible(d))
        .map((d) => ({ id: d.id, text: (d.innerText || '').trim() }))
        .filter((d) => d.text.length > 20);
      m.sort((a, b) => b.text.length - a.text.length);
      return m.length ? m[0].text.slice(0, 300) : '';
    });
    await snap(name);
    results.push({ item: label + ' modal', found: opened && vis.length > 0, textLen: vis.length, shot: name + '.png' });
    // close it
    await page.evaluate(() => {
      const closers = Array.from(document.querySelectorAll('[id*="close"], .modal-close, button')).filter((b) => b.offsetParent !== null && ['×', 'x', 'Skip for Now'].includes(b.textContent.trim()));
      closers.forEach((b) => b.click());
    });
    await page.waitForTimeout(500);
  }

  await browser.close();

  // Report
  let pass = 0;
  for (const r of results) {
    const st = r.found ? 'PASS' : 'FAIL';
    if (r.found) pass++;
    console.log(`${st}  ${r.item}  (panels=${r.panels ?? '-'} textLen=${r.textLen} controls=${r.controls ?? '-'})  -> ${r.shot}`);
  }
  console.log(`\n${pass}/${results.length} items OK`);
  if (consoleErrors.length || failedRequests.length) {
    // Known cosmetic issue: repo has no favicon.ico (logged as QA bug, not a failure)
    const realReqs = [...new Set(failedRequests)].filter((u) => !u.includes('favicon.ico'));
    console.log(`\nFAILED REQUESTS (${new Set(failedRequests).size} unique):`);
    realReqs.slice(0, 20).forEach((u) => console.log('  ' + u));
    if (realReqs.length === 0) { console.log('  (none besides favicon)'); process.exit(pass === results.length ? 0 : 1); }
    process.exit(1);
  } else {
    console.log('Console errors: 0 | Failed requests: 0');
  }
  process.exit(pass === results.length && consoleErrors.length === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
