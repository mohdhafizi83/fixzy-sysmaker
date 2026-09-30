// Verifies the two suffix buttons beside FK lookup dropdowns in generated apps:
//   eye  (view_<parent>)  -> opens the SELECTED parent record in a modal iframe
//   plus (create_<parent>) -> opens the parent create form in a modal iframe
// Flow: login -> course registration create page -> pick student ->
// eye visible -> modal iframe = students/{id}/edit -> close ->
// plus -> modal iframe = students/create -> create student inside modal ->
// new student appears in the parent dropdown.
'use strict';
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');

const BASE = process.env.APP_BASE || 'http://127.0.0.1:8899';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
    if (cond) { pass++; console.log('PASS  ' + name); }
    else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async () => {
    const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

    // 1. Login
    await page.goto(BASE + '/admin/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@admin.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
    console.log('logged in');

    // 2. Course registration create page (FK dropdowns to students + courses)
    await page.goto(BASE + '/admin/courseregistration/create', { waitUntil: 'networkidle' });
    await sleep(1500);

    // Real markup: <button title="View pelajar" aria-label="View pelajar" ...>
    const eyeBtn = page.locator('button[aria-label*="pelajar" i][aria-label*="view" i]').first();
    const plusBtn = page.locator('button[aria-label*="pelajar" i][aria-label*="create" i]').first();
    const MODAL = '.fi-modal-open';
    // The modal container itself has no bounding box (fixed-position children);
    // visibility truth = the iframe inside a modal is visible.
    const visibleIframe = () => page.locator('iframe').locator('visible=true').first();

    check('1. create page loaded with pelajar FK', (await page.locator('#form\\.pelajar_id').count()) === 1);
    check('2. plus (create parent) button rendered', await plusBtn.isVisible().catch(() => false));
    check('3. eye (view parent) hidden before selection', !(await eyeBtn.isVisible().catch(() => false)));

    // 4. Select a student
    await page.locator('#form\\.pelajar_id').click();
    await sleep(600);
    const options = page.locator('.fi-select-input-option');
    const optCount = await options.count();
    check('4. dropdown lists parent options', optCount > 0, 'options=' + optCount);
    const chosenText = optCount > 0 ? (await options.first().innerText()).trim() : '';
    const chosenId = optCount > 0 ? await options.first().getAttribute('data-value') : '';
    await options.first().click();
    await sleep(1200);
    console.log('chosen:', chosenText, 'id=' + chosenId);

    // 5. Eye now visible -> opens modal iframe of the selected student's EDIT page
    check('5. eye button visible after selection', await eyeBtn.isVisible().catch(() => false));
    await eyeBtn.click();
    await sleep(3000);
    const modal = page.locator(MODAL).first();
    check('6. eye opens a modal', await visibleIframe().isVisible().catch(() => false));
    const iframe = visibleIframe();
    const iframeSrc = await iframe.getAttribute('src').catch(() => '');
    check('7. modal contains iframe', (await page.locator(MODAL + ' iframe').count()) >= 1, 'src=' + iframeSrc);
    check('8. iframe = students/' + chosenId + '/edit', new RegExp('students/' + chosenId + '/edit').test(iframeSrc || ''), 'src=' + iframeSrc);
    check('9. iframe carries iframe=1 flag', (iframeSrc || '').includes('iframe=1'));
    const frame = page.frames().find((f) => (f.url() || '').includes('iframe=1'));
    if (frame) {
        await frame.waitForLoadState('domcontentloaded');
        await sleep(1500);
        const bodyText = await frame.locator('body').innerText().catch(() => '');
        check('10. iframe edit form renders (no error)', bodyText.length > 50 && !/404|not found|whoops/i.test(bodyText), 'len=' + bodyText.length);
        // the chosen name lives in an input VALUE (edit form), not visible text
        const inputVals = await frame.locator('input').evaluateAll(els => els.map(e => e.value).join(' | '));
        const surname = chosenText.split(' ').filter(Boolean).slice(-1)[0] || '';
        check('11. iframe shows the chosen student', inputVals.includes(chosenText) || inputVals.includes(surname), 'surname=' + surname);
    } else {
        check('10. iframe edit form renders (no error)', false, 'frame not found');
        check('11. iframe shows the chosen student', false, 'no frame');
    }
    await page.keyboard.press('Escape');
    await sleep(1500);
    // ensure the eye modal is fully closed before opening the plus modal
    if (await page.locator(MODAL).first().isVisible().catch(() => false)) {
        const closeBtn = page.locator(MODAL + ' .fi-modal-close, ' + MODAL + ' button[aria-label*="close" i]').first();
        if (await closeBtn.count()) { await closeBtn.click(); await sleep(1200); }
    }

    // 6. Plus -> modal iframe of student CREATE page
    await plusBtn.click();
    await sleep(3000);
    const modal2 = page.locator(MODAL).filter({ has: page.locator('iframe') }).last();
    check('12. plus opens a modal', await visibleIframe().isVisible().catch(() => false));
    const iframe2 = visibleIframe();
    const src2 = await iframe2.getAttribute('src').catch(() => '');
    check('13. iframe = students/create', /students\/create/.test(src2 || ''), 'src=' + src2);
    const frame2 = page.frames().find((f) => (f.url() || '').includes('students/create'));
    if (frame2) {
        await frame2.waitForLoadState('domcontentloaded');
        await sleep(1500);
        const body2 = await frame2.locator('body').innerText().catch(() => '');
        check('14. iframe create form renders', body2.length > 50 && !/404|not found|whoops/i.test(body2), 'len=' + body2.length);
    } else {
        check('14. iframe create form renders', false, 'frame not found');
    }

    // 7. Create a student INSIDE the modal, confirm it lands in the parent dropdown
    const NEWNAME = 'Zulaikha Testchild';
    if (frame2) {
        const nameInput = frame2.locator('#form\\.nama_penuh');
        const matrikInput = frame2.locator('#form\\.no_matrik');
        if (await nameInput.count() && await matrikInput.count()) {
            await nameInput.fill(NEWNAME);
            await matrikInput.fill('MTX-' + Date.now().toString().slice(-7));
            const saveBtn = frame2.getByRole('button', { name: 'Create', exact: true }).first();
            await saveBtn.click({ force: true });
            await sleep(5000);
            // close any open modal window via its close button (Escape unreliable here)
            const closer = page.locator('.fi-modal-window-has-close-btn .fi-modal-close, .fi-modal-open button[aria-label*="close" i]').first();
            if (await closer.count()) { await closer.evaluate((el) => el.click()).catch(() => {}); }
            await sleep(1500);
            await page.locator('#form\\.pelajar_id').click({ force: true });
            await sleep(1000);
            const found = await page.locator('.fi-select-input-option', { hasText: NEWNAME }).count();
            check('15. new student from modal appears in dropdown', found > 0, 'found=' + found);
            await page.keyboard.press('Escape');
        } else {
            check('15. new student from modal appears in dropdown', false, 'name input not found in iframe');
        }
    } else {
        check('15. new student from modal appears in dropdown', false, 'no create frame');
    }

    console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
    if (errors.length) console.log('page errors:', errors.slice(0, 5).join(' | '));
    await browser.close();
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(2); });
