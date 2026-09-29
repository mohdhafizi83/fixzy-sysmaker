// Captures GENERATED-app screenshots from the showcase build (e2e workdir).
// Run: node test/shot_generated_showcase.js   (app served on 127.0.0.1:8899)
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');

const BASE = 'http://127.0.0.1:8899';
const OUT = process.env.SHOT_OUT || '/tmp/showcase_shots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 2600 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  // Login
  await page.goto(BASE + '/admin/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@admin.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
  console.log('logged in');

  // 1. Generated dashboard — all widget charts rendered
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  await sleep(6000); // let charts render + poll refresh
  await page.screenshot({ path: path.join(OUT, '08_generated_dashboard.png'), fullPage: true });
  console.log('shot: 08_generated_dashboard');

  // 2. List page with data (Students module -> /admin/students)
  await page.goto(BASE + '/admin/students', { waitUntil: 'networkidle' });
  await sleep(2500);
  await page.screenshot({ path: path.join(OUT, '09_generated_list.png'), fullPage: true });
  console.log('shot: 09_generated_list');

  // 3. Kiosk wall display (route is /admin/kiosk)
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(BASE + '/admin/kiosk', { waitUntil: 'networkidle' });
  await sleep(5000);
  await page.screenshot({ path: path.join(OUT, '10_kiosk.png') });
  console.log('shot: 10_kiosk');

  console.log('errors:', errors.length ? errors.slice(0, 5).join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
