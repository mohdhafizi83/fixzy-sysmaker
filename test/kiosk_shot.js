// Capture kiosk-mode screenshot for README.
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');
const BASE = 'http://127.0.0.1:8899';

(async () => {
    const browser = await chromium.launch({
        executablePath: resolveChrome(),
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.goto(BASE + '/admin/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@admin.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 });
    console.log('logged in');

    await page.goto(BASE + '/admin/kiosk', { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 7000));
    await page.screenshot({ path: '/tmp/fsm-live-test/kiosk1.png' });
    console.log('kiosk page 1 captured');
    // wait for rotation to page 2
    await new Promise(r => setTimeout(r, 22000));
    await page.screenshot({ path: '/tmp/fsm-live-test/kiosk2.png' });
    console.log('kiosk page 2 captured (after rotation)');
    await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
