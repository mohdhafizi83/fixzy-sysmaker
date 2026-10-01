// Captures the full SysMaker GUI screenshot set from the seeded showcase store.
// Run: node test/shot_gui_showcase.js   (fixzy serve on 7788 with FSM_DATA_DIR=/tmp/fixzy_showcase)
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');

const BASE = 'http://127.0.0.1:7788/';
const OUT = process.env.SHOT_OUT || '/tmp/showcase_shots';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await sleep(1200);

  // Close any modal that pops (welcome/tutorial)
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.add('hidden'));
  });
  await sleep(400);

  const clickTab = async (tab) => {
    await page.evaluate((t) => {
      const b = document.querySelector(`.tab-link[data-tab="${t}"]`);
      if (b) b.click();
    }, tab);
    await sleep(700);
  };

  const closeHelp = async () => {
    await page.evaluate(() => {
      const p = document.getElementById('fixzy-help-panel');
      if (p) p.classList.remove('fixzy-help-open');
      try { localStorage.setItem('fixzy-help-visible', '0'); } catch (e) {}
    });
    await sleep(300);
  };

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
    console.log('shot:', name);
  };

  // 1. Stack & Core tab — full module checklist (help closed so right column is visible)
  await closeHelp();
  await clickTab('tab-stack');
  await sleep(400);
  await shot('01_stack_core');

  // 2. Help panel demo — focus a field, panel shows explanation
  await page.evaluate(() => {
    const p = document.getElementById('fixzy-help-panel');
    if (p) p.classList.add('fixzy-help-open');
  });
  await page.evaluate(() => {
    const el = document.getElementById('app-module-log-activity');
    const lab = el ? el.closest('label') : null;
    (lab || el)?.click();
  });
  await sleep(600);
  await shot('02_help_panel_demo');
  await closeHelp();

  // 3. Models Design — table with fields visible
  await clickTab('tab-models-design');
  await sleep(500);
  // Select the 'pelajar' table in the sidebar if present
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#tables-list li, .table-list-item, [data-table-name]'));
    const target = items.find((i) => /pelajar$/i.test(i.getAttribute('data-table-name') || i.textContent || ''));
    if (target) target.click();
  });
  await sleep(700);
  await shot('03_models_design');

  // 4. Menu management — tree with groups expanded (tall viewport so the GUI's
  // internal 100vh scroll shows the whole tree in one capture)
  await page.setViewportSize({ width: 1440, height: 2600 });
  await clickTab('tab-menu-appearance');
  await sleep(700);
  await shot('04_menu_management');
  await page.setViewportSize({ width: 1440, height: 900 });

  // 5. Theme tab
  await clickTab('tab-theme');
  await sleep(500);
  await shot('05_theme');

  // 6. Dashboard Builder — all 16 widgets visible (tall viewport)
  await page.setViewportSize({ width: 1440, height: 2600 });
  await clickTab('tab-dashboard-builder');
  await sleep(700);
  await shot('06_dashboard_builder');
  await page.setViewportSize({ width: 1440, height: 900 });

  // 7. Security & technical — tab removed 2026-10-01 (rebuilt later).

  console.log('errors:', errors.length ? errors.slice(0, 5).join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
