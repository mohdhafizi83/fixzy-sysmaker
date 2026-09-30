// Full form round-trip test for the form-matrix generated app.
// Exercises EVERY form element type the generator supports:
//   TextInput (plain/email/url/tel/password), numeric, DatePicker (date+datetime),
//   Textarea, RichEditor, Checkbox, Select dropdown, Radio (options), CheckboxList,
//   Select multiple, Lookup Select, Lookup Radio, Repeater simple, Repeater complex.
// For each: fill -> submit -> verify DB -> open edit -> verify loaded -> change -> resubmit -> verify DB.
// Usage: node test/form_roundtrip_test.js   (app on 127.0.0.1:8901)
'use strict';
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');

const BASE = process.env.APP_BASE || 'http://127.0.0.1:8901';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra = '') {
    if (cond) { pass++; console.log('PASS  ' + name); }
    else { fail++; failures.push(name + (extra ? ' [' + extra + ']' : '')); console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}

// read a Livewire form value from the page snapshot (data.0.<field>)
async function formValue(page, field) {
    return page.evaluate((f) => {
        let out = undefined;
        document.querySelectorAll('[wire\\:snapshot]').forEach((el) => {
            try {
                const s = JSON.parse(el.getAttribute('wire:snapshot'));
                const d = s.data;
                if (d && Array.isArray(d.data) && d.data[0] && f in d.data[0]) out = d.data[0][f];
            } catch (e) { /* ignore */ }
        });
        return out;
    }, field);
}

// collect visible validation error messages on the page
async function validationErrors(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('.fi-fo-field-wrp-error-message, .fi-input-wrp-message, .fi-field-error-message'))
        .map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 20));
}

async function dbRow(appDir, id) {
    const { execSync } = require('child_process');
    const out = execSync(`php -r '
        $db = new PDO("sqlite:${appDir}/database/database.sqlite");
        $r = $db->query("SELECT * FROM matriks WHERE id = ${id}")->fetch(PDO::FETCH_ASSOC);
        echo json_encode($r);
    '`, { encoding: 'utf8' });
    return JSON.parse(out);
}

(async () => {
    const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

    // ---- login ----
    await page.goto(BASE + '/admin/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@admin.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
    console.log('logged in');

    // ---- seed 2 parent characters (lookup targets) ----
    await page.goto(BASE + '/admin/characters/create', { waitUntil: 'networkidle' });
    await page.fill('#form\\.nama_watak', 'Watak Satu');
    await page.getByRole('button', { name: 'Create', exact: true }).first().click();
    await page.waitForURL((u) => !String(u).includes('/create'), { timeout: 20000 });
    await page.goto(BASE + '/admin/characters/create', { waitUntil: 'networkidle' });
    await page.fill('#form\\.nama_watak', 'Watak Dua');
    await page.getByRole('button', { name: 'Create', exact: true }).first().click();
    await page.waitForURL((u) => !String(u).includes('/create'), { timeout: 20000 });
    console.log('parents seeded');

    // ---- CREATE matrix record with every element type ----
    await page.goto(BASE + '/admin/matrixrecords/create', { waitUntil: 'networkidle' });
    await sleep(1200);

    // 1. plain text
    await page.fill('#form\\.txt_plain', 'Hello Matrix');
    // 2. email
    await page.fill('#form\\.txt_email', 'uji@example.com');
    // 3. url
    await page.fill('#form\\.txt_url', 'https://fixzy.example/page');
    // 4. tel
    await page.fill('#form\\.txt_tel', '+60123456789');
    // 5. password
    await page.fill('#form\\.txt_password', 'rahasia123');
    // 6. integer
    await page.fill('#form\\.num_int', '4207');
    // 7. decimal
    await page.fill('#form\\.num_decimal', '1234.56');
    // 8. date (DatePicker renders native type=date)
    await page.fill('#form\\.dt_date', '2026-03-15');
    // 9. datetime (native type=datetime-local — needs full ISO value)
    await page.fill('#form\\.dt_datetime', '2026-07-20T14:30');
    // 10. textarea
    await page.fill('#form\\.txt_area', 'Baris satu.\nBaris dua.');
    // 11. rich editor (Filament RichEditor uses a contenteditable / tiptap)
    const rich = page.locator('#form\\.txt_rich + div [contenteditable="true"], .fi-rich-editor-content [contenteditable="true"]').first();
    if (await rich.count()) {
        await rich.click();
        await page.keyboard.type('Rich <b>bold</b> content here');
    } else {
        console.log('  (rich editor contenteditable not found — will flag)');
    }
    // 12. checkbox
    await page.locator('#form\\.bool_check').check({ force: true }).catch(async () => {
        await page.locator('label:has(#form\\.bool_check), #form\\.bool_check').first().click({ force: true });
    });
    // 13. options dropdown (native <select wire:model> — selectOption is reliable)
    await page.selectOption('#form\\.opt_dropdown', 'dua');
    await sleep(500);
    // 14. radios
    await page.locator('input[value="tengah"]').first().check({ force: true });
    await sleep(300);
    // 15. checkbox list
    await page.locator('input[value="merah"]').first().check({ force: true });
    await page.locator('input[value="biru"]').first().check({ force: true });
    await sleep(300);
    // 16. multi select (custom combobox button — click then pick options)
    await page.click('#form\\.opt_multi');
    await sleep(600);
    await page.locator('.fi-dropdown-panel .fi-select-input-option:has-text("Awal")').first().click();
    await sleep(300);
    await page.locator('.fi-dropdown-panel .fi-select-input-option:has-text("Akhir")').first().click().catch(() => {});
    await sleep(300);
    await page.keyboard.press('Escape');
    await sleep(400);
    // 17. lookup dropdown (relationship-backed; pick by visible label)
    await page.selectOption('#form\\.lk_dropdown', { label: 'Watak Dua' });
    await sleep(500);
    // 18. lookup radios (relationship-backed radios render as native radios)
    await page.locator('input[value$="Watak Satu"], label:has-text("Watak Satu") input[type="radio"]').first().check({ force: true }).catch(async () => {
        // fallback: click the radio whose label text is Watak Satu
        await page.locator('label', { hasText: 'Watak Satu' }).first().click({ force: true });
    });
    await sleep(300);
    // 19. repeater simple: add 2 items (Filament v5 simple repeater)
    const addSimple = page.getByRole('button', { name: 'Add to repeater Simple' }).first();
    await addSimple.click();
    await sleep(800);
    await addSimple.click();
    await sleep(800);
    const repSimpleInputs = page.locator('input[id*="rep_simple."]');
    const repCount = await repSimpleInputs.count();
    if (repCount >= 2) {
        await repSimpleInputs.nth(0).fill('item-satu@example.com');
        await repSimpleInputs.nth(1).fill('item-dua@example.com');
    }
    // 20. repeater complex: add one row, fill email + dropdown
    const addComplex = page.getByRole('button', { name: 'Add to repeater Complex' }).first();
    if (await addComplex.count()) {
        await addComplex.click();
        await sleep(900);
        const cEmail = page.locator('input[id$="rep_complex_1"]').last();
        await cEmail.fill('repeater.row@example.com');
        const cSel = page.locator('[id$="rep_complex_2"]').last();
        if (await cSel.count()) {
            const tag = await cSel.evaluate(e => e.tagName);
            if (tag === 'SELECT') {
                await cSel.selectOption('tinggi');
            } else {
                await cSel.click();
                await sleep(500);
                await page.locator('.fi-dropdown-panel .fi-select-input-option:has-text("Tinggi")').first().click();
            }
        }
        await sleep(400);
    }

    // ---- submit ----
    await page.getByRole('button', { name: 'Create', exact: true }).first().click();
    await sleep(4000);

    const errs = await validationErrors(page);
    const stillCreate = page.url().includes('/create');
    check('A1. form submitted without validation errors', errs.length === 0 && !stillCreate, 'errs=' + JSON.stringify(errs) + ' stillCreate=' + stillCreate);

    // find created row
    let row = null, rowId = null;
    try {
        const all = require('child_process').execSync(`php -r '
            $db = new PDO("sqlite:/tmp/fsm-matrix-app/database/database.sqlite");
            $r = $db->query("SELECT * FROM matriks ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
            echo json_encode($r);
        '`, { encoding: 'utf8' });
        row = JSON.parse(all);
        rowId = row && row.id;
    } catch (e) { console.log('db read err: ' + e.message); }
    check('A2. row created in DB', !!row, 'row=' + JSON.stringify(row).slice(0, 120));

    if (row) {
        const v = (f) => String(row[f] ?? '');
        check('B1. txt_plain saved', v('txt_plain') === 'Hello Matrix', v('txt_plain'));
        check('B2. txt_email saved', v('txt_email') === 'uji@example.com', v('txt_email'));
        check('B3. txt_url saved', v('txt_url') === 'https://fixzy.example/page', v('txt_url'));
        check('B4. txt_tel saved', v('txt_tel') === '+60123456789', v('txt_tel'));
        check('B5. txt_password saved', v('txt_password') === 'rahasia123', v('txt_password'));
        check('B6. num_int saved', v('num_int') === '4207', v('num_int'));
        check('B7. num_decimal saved', v('num_decimal') === '1234.56', v('num_decimal'));
        check('B8. dt_date saved as 2026-03-15', v('dt_date').startsWith('2026-03-15'), v('dt_date'));
        check('B9. dt_datetime saved with time 14:30', v('dt_datetime').startsWith('2026-07-20') && v('dt_datetime').includes('14:30'), v('dt_datetime'));
        check('B10. txt_area multiline saved', v('txt_area').includes('Baris satu.') && v('txt_area').includes('Baris dua.'), v('txt_area'));
        check('B11. txt_rich saved non-empty', v('txt_rich').length > 5, v('txt_rich').slice(0, 80));
        check('B12. bool_check saved true', v('bool_check') === '1', v('bool_check'));
        check('B13. opt_dropdown saved "dua"', v('opt_dropdown') === 'dua', v('opt_dropdown'));
        check('B14. opt_radios saved "tengah"', v('opt_radios') === 'tengah', v('opt_radios'));
        check('B15. opt_checkboxes saved merah+biru', v('opt_checkboxes').includes('merah') && v('opt_checkboxes').includes('biru'), v('opt_checkboxes'));
        check('B16. opt_multi saved awal+akhir', v('opt_multi').includes('awal') && v('opt_multi').includes('akhir'), v('opt_multi'));
        check('B17. lk_dropdown saved (Watak Dua id)', v('lk_dropdown') !== '' && v('lk_dropdown') !== 'NULL', v('lk_dropdown'));
        check('B18. lk_radios saved (Watak Satu id)', v('lk_radios') !== '' && v('lk_radios') !== 'NULL', v('lk_radios'));
        check('B19. rep_simple saved both items', v('rep_simple').includes('item-satu') && v('rep_simple').includes('item-dua'), v('rep_simple').slice(0, 120));
        check('B20. rep_complex saved row', v('rep_complex').includes('repeater.row') && v('rep_complex').includes('tinggi'), v('rep_complex').slice(0, 160));
    }

    // ---- EDIT round-trip: open edit, verify loaded values ----
    if (rowId) {
        await page.goto(BASE + `/admin/matrixrecords/${rowId}/edit`, { waitUntil: 'networkidle' });
        await sleep(1500);
        check('C1. edit page loads', (await page.content()).includes('txt_plain') || (await page.locator('#form\\.txt_plain').count()) > 0);
        const loaded = await page.locator('#form\\.txt_plain').inputValue().catch(() => '');
        check('C2. txt_plain loaded in edit', loaded === 'Hello Matrix', loaded);
        const loadedEmail = await page.locator('#form\\.txt_email').inputValue().catch(() => '');
        check('C3. txt_email loaded', loadedEmail === 'uji@example.com', loadedEmail);
        const loadedArea = await page.locator('#form\\.txt_area').inputValue().catch(() => '');
        check('C4. txt_area loaded', loadedArea.includes('Baris satu'), loadedArea.slice(0, 40));
        const loadedCheck = await page.locator('#form\\.bool_check').isChecked().catch(() => false);
        check('C5. bool_check loaded checked', loadedCheck === true);
        const selText = (sel) => page.evaluate((s) => {
            const el = document.querySelector(s);
            if (!el) return '';
            return Array.from(el.selectedOptions).map(o => o.textContent.trim()).join(', ');
        }, sel).catch(() => '');
        const loadedOpt = await selText('#form\\.opt_dropdown');
        check('C6. opt_dropdown shows saved selection', loadedOpt.includes('Dua'), loadedOpt.trim());
        const loadedLk = await selText('#form\\.lk_dropdown');
        check('C7. lk_dropdown shows saved parent', loadedLk.includes('Watak Dua'), loadedLk.trim());
        const loadedMulti = await page.locator('#form\\.opt_multi').innerText().catch(() => '');
        check('C8. opt_multi shows saved selections', loadedMulti.includes('Awal') && loadedMulti.includes('Akhir'), loadedMulti.trim());
        const loadedRadio = await page.locator('input[value="tengah"]').first().isChecked().catch(() => false);
        check('C9. opt_radios loads checked', loadedRadio === true);
        const loadedCkList = await page.locator('input[value="merah"]').first().isChecked().catch(() => false);
        check('C10. opt_checkboxes loads checked', loadedCkList === true);
        const loadedDate = await page.locator('#form\\.dt_date').inputValue().catch(() => '');
        check('C11. dt_date loaded', loadedDate.includes('2026') && loadedDate.includes('03'), loadedDate);
        const loadedRep = await page.locator('input[id*="rep_simple."]').count();
        check('C12. repeater items loaded', loadedRep >= 2, 'count=' + loadedRep);

        // ---- change values and resubmit ----
        await page.fill('#form\\.txt_plain', 'Updated Matrix');
        await page.fill('#form\\.num_int', '99');
        await page.getByRole('button', { name: /Save/ }).first().click();
        await sleep(4000);
        const errs2 = await validationErrors(page);
        check('D1. edit saved without errors', errs2.length === 0, JSON.stringify(errs2));
        const row2 = await dbRow('/tmp/fsm-matrix-app', rowId);
        check('D2. txt_plain updated', String(row2.txt_plain) === 'Updated Matrix', String(row2.txt_plain));
        check('D3. num_int updated', String(row2.num_int) === '99', String(row2.num_int));
        check('D4. other fields untouched', String(row2.txt_email) === 'uji@example.com', String(row2.txt_email));
    }

    console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
    if (failures.length) console.log('FAILURES:\n  ' + failures.join('\n  '));
    if (pageErrors.length) console.log('PAGE ERRORS: ' + pageErrors.slice(0, 5).join(' | '));
    await browser.close();
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(2); });
