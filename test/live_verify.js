// Live-mode end-to-end verification with a real Reverb WebSocket server.
// 1. Log in to the generated app.
// 2. Open the dashboard, find a LIVE widget, capture its value.
// 3. Insert a row directly via artisan tinker (bypassing the UI).
// 4. Assert the widget value changes WITHOUT a page reload (push via Echo).
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');

const BASE = 'http://127.0.0.1:8899';
const APP = '/tmp/fsm-live-test/app';
const { execSync } = require('child_process');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
    const browser = await chromium.launch({
        executablePath: resolveChrome(),
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    // 1. Login
    await page.goto(BASE + '/admin/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@admin.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 });
    console.log('logged in');

    // 2. Go to the dashboard page that hosts the live widgets
    await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    await sleep(2500);

    // Confirm Echo connected to Reverb (window.Echo exists after CDN load)
    const echoOk = await page.evaluate(() => !!window.Echo);
    console.log('window.Echo loaded:', echoOk);
    if (!echoOk) throw new Error('Echo client not loaded — live widgets cannot subscribe');

    // Grab the LIVE table widget (w4 'Latest Stock') — check whether the
    // marker row appears without a page reload.
    const readValue = async () => page.evaluate(() => {
        return document.body.innerText.includes('LIVE-TEST-99');
    });

    const before = await readValue();
    console.log('marker visible BEFORE insert:', before);
    if (before) throw new Error('marker already present before insert — bad test');

    await page.screenshot({ path: '/tmp/fsm-live-test/before.png' });

    // 3. Insert via the Eloquent MODEL (observers only fire on model events,
    //    not DB::table query-builder inserts) -> FixzyLiveObserver -> DataChanged -> Reverb
    execSync(
        `php artisan tinker --execute="App\\Models\\Inventori::create(['item_name'=>'LIVE-TEST-99','kuantiti'=>777,'harga_seunit'=>10]); echo 'inserted';"`,
        { cwd: APP, timeout: 60000, stdio: 'pipe' }
    );
    console.log('row inserted via tinker');

    // 4. Wait up to 15s for the pushed refresh (no reload!)
    let changed = null;
    for (let i = 0; i < 30; i++) {
        await sleep(500);
        const now = await readValue();
        if (now !== before) { changed = now; break; }
    }
    await page.screenshot({ path: '/tmp/fsm-live-test/after.png' });

    if (changed === true) {
        console.log('LIVE PUSH VERIFIED: LIVE-TEST-99 appeared in Latest Stock (no page reload)');
    } else {
        console.log('NO CHANGE after 15s — live push FAILED');
        await browser.close();
        process.exit(2);
    }

    // 5. Kiosk screenshot for README
    await page.goto(BASE + '/admin/kiosk', { waitUntil: 'networkidle' });
    await sleep(3000);
    await page.screenshot({ path: '/tmp/fsm-live-test/kiosk.png', fullPage: false });
    console.log('kiosk screenshot saved');

    await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
