const { chromium } = require('playwright-core');
const BASE = 'http://127.0.0.1:8899';
(async () => {
    const browser = await chromium.launch({
        executablePath: '/home/fizi/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(BASE + '/admin/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@admin.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 });
    await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: '/tmp/fsm-live-test/dash_full.png' });
    console.log('dashboard captured');
    await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
