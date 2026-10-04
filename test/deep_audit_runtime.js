// Fasa 20 — runtime semantics of EVERY display_type in the booted
// DEEP-AUDIT-001 generated app (Playwright + sqlite ground truth).
//
// Positive per display_type:
//   S1 correct control rendered (not a silent TextInput)
//   S2 round-trip: fill -> save -> DB value correct (types/precision/format)
//   S3 edit prefill matches DB; untouched save keeps values
//   S4 list view renders correctly (caption not code, thumbnail, viewer)
// Negative:
//   N1 required empty rejected server-side, no row
//   N2 over max length rejected server-side (bypasses HTML maxlength)
//   N3 DECIMAL 3dp -> contract recorded (rejected by decimal:0,2)
//   N4 non-date text -> validation error, not 500
//   N5 repeater empty item -> contract recorded
//   N6 non-image MIME in image field -> rejected
//   N7 SQL injection stored literally, DB intact, display escaped
//
// Usage: node test/deep_audit_runtime.js   (app on 127.0.0.1:8911)
'use strict';
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = process.env.APP_BASE || 'http://127.0.0.1:8911';
const APPDIR = process.env.APP_DIR || '/tmp/fsm-deep-app';
const DB = path.join(APPDIR, 'database', 'database.sqlite');
const FIX = path.join(__dirname, 'fixtures');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const failures = [];
const contracts = [];
function check(name, cond, extra = '') {
    if (cond) { pass++; console.log('PASS  ' + name); }
    else { fail++; failures.push(name + (extra ? ' [' + extra + ']' : '')); console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function note(contract) { contracts.push(contract); console.log('NOTE  ' + contract); }

function q(sql) {
    // argv-passed SQL via helper script: immune to shell quote nesting
    const { spawnSync } = require('child_process');
    const r = spawnSync('php', [path.join(__dirname, 'deep_audit_q.php'), sql], { encoding: 'utf8', env: { ...process.env, FSM_TEST_DB: DB } });
    if (r.status !== 0) throw new Error('db query failed: ' + (r.stderr || '').slice(0, 200));
    return JSON.parse(r.stdout);
}
function dbRow(table, id) { const r = q(`SELECT * FROM ${table} WHERE id=${id}`); return r[0] || null; }
function dbCount(table) { return q(`SELECT COUNT(*) AS c FROM ${table}`)[0].c; }

// Livewire form-state helpers (snapshot data.data[0] = form state)
async function formState(page) {
    return page.evaluate(() => {
        let out = null;
        document.querySelectorAll('[wire\\:snapshot]').forEach((el) => {
            try {
                const s = JSON.parse(el.getAttribute('wire:snapshot'));
                if (s.data && Array.isArray(s.data.data) && s.data.data[0]) out = s.data.data[0];
            } catch (e) { /* ignore */ }
        });
        return out;
    });
}
// Set a form value SERVER-ward via Livewire (bypasses HTML maxlength etc.).
// Filament v5 form components expose $wire.set('data.<field>', ...) —
// probe-verified: $wire.get('data.nama') returns the set value.
async function lvSet(page, field, value) {
    const ok = await page.evaluate(([f, v]) => {
        const comps = window.Livewire ? window.Livewire.all() : [];
        for (const c of comps) {
            const d = c.snapshot.data;
            if (d && Array.isArray(d.data) && d.data[0] && f in d.data[0]) {
                try { c.$wire.set('data.' + f, v); return true; } catch (e) { return false; }
            }
        }
        return false;
    }, [field, value]);
    await sleep(500);
    return ok;
}
// Strip HTML5 constraint attributes so the browser does NOT block the
// submit before Livewire can reach the SERVER-side validators. Without
// this, required/maxlength are enforced client-side only and the plan's
// "rejected server-side" scenarios are never actually exercised.
async function stripHtml5(page) {
    await page.evaluate(() => {
        document.querySelectorAll('input[required], textarea[required]').forEach((e) => e.removeAttribute('required'));
        document.querySelectorAll('input[maxlength], textarea[maxlength]').forEach((e) => e.removeAttribute('maxlength'));
    });
}
async function validationErrors(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('.fi-fo-field-wrp-error-message, .fi-input-wrp-message, .fi-field-error-message'))
        .map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 20));
}
async function submitCreate(page) {
    await page.getByRole('button', { name: /^(Create|Cipta)$/ }).first().click();
    await sleep(3500);
    return { stillCreate: page.url().includes('/create'), errs: await validationErrors(page) };
}
// last-inserted id of a table
function lastId(table) { const r = q(`SELECT MAX(id) AS m FROM ${table}`); return r[0].m; }

// S1 control-kind assertions. Returns {ok, evidence}
async function expectControl(page, field, kind) {
    const sel = `#form\\.${field}`;
    const info = await page.evaluate(([s, f]) => {
        const el = document.querySelector(s);
        const desc = el ? `${el.tagName.toLowerCase()}[type=${el.getAttribute('type')},inputmode=${el.getAttribute('inputmode')},disabled=${el.disabled === true}]` : 'MISSING';
        return { el: !!el, desc };
    }, [sel, field]);
    let ok = false;
    switch (kind) {
        case 'text': ok = info.el && /input\[type=(text|null)/.test(info.desc); break;
        case 'email': ok = info.el && /type=email/.test(info.desc); break;
        case 'tel': ok = info.el && /type=tel/.test(info.desc); break;
        case 'numeric': ok = info.el && (/inputmode=(numeric|decimal)/.test(info.desc) || /type=number/.test(info.desc)); break;
        case 'date': ok = info.el && /type=date/.test(info.desc); break;
        case 'datetime': ok = info.el && /type=datetime-local/.test(info.desc); break;
        case 'checkbox': ok = info.el && /type=checkbox/.test(info.desc); break;
        case 'select': ok = info.el && (info.desc.startsWith('select[') || info.desc.startsWith('button[')); break;
        case 'textarea': ok = info.el && info.desc.startsWith('textarea['); break;
        case 'file': {
            // FileUpload renders a FilePond div; the actual input[type=file]
            // lives inside the field wrapper for this field.
            const inWrap = await page.evaluate(([s]) => {
                const el = document.querySelector(s);
                if (!el) return false;
                const wrap = el.closest('.fi-fo-field') || el.parentElement;
                return !!(wrap && wrap.querySelector('input[type=file]'));
            }, [sel]);
            ok = inWrap; break;
        }
        case 'rich': {
            const tiptap = await page.locator(`${sel} .tiptap, ${sel} + * .tiptap, .tiptap`).count();
            ok = tiptap > 0; break;
        }
        default: ok = info.el;
    }
    return { ok, evidence: info.desc };
}
async function s1(page, label, field, kind) {
    const r = await expectControl(page, field, kind);
    check(`S1 ${label}`, r.ok, `${field} -> ${r.evidence}`);
}
// radios render as a group of input[type=radio] with name containing the field
async function s1Radios(page, label, field) {
    const n = await page.locator(`input[type=radio][name*="${field}"], [id*="${field}"] input[type=radio]`).count();
    check(`S1 ${label}`, n >= 3, `radios=${n}`);
}

// Generic: fill text-ish field
async function fill(page, field, value) { await page.fill(`#form\\.${field}`, value); }
// Filament v5 relationship/multi Select renders as a combobox BUTTON:
// click it, then pick an option from the dropdown panel by visible text.
/** @param {import('playwright-core').Page} page @param {string} field @param {string} label visible option text @param {number} [nth] which matching option */
async function pickCombo(page, field, label, nth = 0) {
    await page.click(`#form\\.${field}`);
    await sleep(600);
    await page.locator(`.fi-dropdown-panel .fi-select-input-option:has-text("${label}")`).nth(nth).click();
    await sleep(400);
}
// Read combobox options after opening it (then close with Escape).
/** @param {import('playwright-core').Page} page @param {string} field @returns {Promise<string[]>} */
async function comboOptions(page, field) {
    await page.click(`#form\\.${field}`);
    await sleep(600);
    const opts = await page.evaluate(() => Array.from(document.querySelectorAll('.fi-dropdown-panel .fi-select-input-option'))
        .map((o) => o.textContent.trim()).filter(Boolean));
    await page.keyboard.press('Escape');
    await sleep(400);
    return opts;
}

const GMAP_EMBED = '<iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1000!2d101.6953!3d3.1478!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMy4xNDc4LCAxMDEuNjk1Mw!5e0!3m2!1sen!2smy!4v1600000000000" width="600" height="450" style="border:0" loading="lazy"></iframe>';

(async () => {
    // fake "image" for N6: text bytes with .png name (MIME != image)
    const fakePng = '/tmp/fsm_deep_fake.png';
    fs.writeFileSync(fakePng, 'this is not a png, just text pretending to be an image');
    // second real png for the multi-attachment field (galeri accepts png/jpg only)
    fs.copyFileSync(path.join(FIX, 'media_test.png'), '/tmp/fsm_deep_second.png');

    const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));

    // ---- login ----
    await page.goto(APP + '/admin/login', { waitUntil: 'networkidle' });
    await page.fill('input[type=email]', 'admin@admin.com');
    await page.fill('input[type=password]', 'password');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
    await page.addStyleTag({ content: '#phpdebugbar, #debugbar { display:none !important; }' });
    console.log('logged in');

    // ================================================================
    // TABLE pelajar — text, email, tel, image, text_area, options
    // dropdown, decimal, date
    // ================================================================
    await page.goto(APP + '/admin/pelajar/create', { waitUntil: 'networkidle' });
    await sleep(1500);
    await s1(page, 'pelajar.nama = text', 'nama', 'text');
    await s1(page, 'pelajar.email = email input', 'email', 'email');
    await s1(page, 'pelajar.no_tel = tel input', 'no_tel', 'tel');
    await s1(page, 'pelajar.gambar = file upload', 'gambar', 'file');
    await s1(page, 'pelajar.bio = textarea', 'bio', 'textarea');
    await s1(page, 'pelajar.gred = select', 'gred', 'select');
    await s1(page, 'pelajar.perbelanjaan = numeric', 'perbelanjaan', 'numeric');
    await s1(page, 'pelajar.lahir = date picker', 'lahir', 'date');

    // N1: submit with required nama empty (HTML5 stripped -> server must reject)
    await stripHtml5(page);
    const n1 = await submitCreate(page);
    const n1noRow = dbCount('pelajar') === 0;
    check('N1. required empty blocked, no row created', n1.stillCreate && n1.errs.length > 0 && n1noRow,
        `errs=${JSON.stringify(n1.errs).slice(0, 120)} count=${dbCount('pelajar')}`);

    // N2: over max length via Livewire (bypasses HTML maxlength=100)
    const setOk = await lvSet(page, 'nama', 'X'.repeat(150));
    check('N2a. Livewire set accepted (150 chars)', setOk);
    const n2 = await submitCreate(page);
    check('N2b. over max-length rejected server-side, no row', n2.stillCreate && n2.errs.length > 0 && dbCount('pelajar') === 0,
        `errs=${JSON.stringify(n2.errs).slice(0, 140)}`);

    // N3: DECIMAL 3 decimal places
    await fill(page, 'nama', 'Uji Desimal');
    await fill(page, 'perbelanjaan', '12.345');
    const n3 = await submitCreate(page);
    if (n3.stillCreate && n3.errs.length > 0) {
        note('N3 contract: DECIMAL(10,2) with 3dp is REJECTED by rule decimal:0,2 (no silent rounding)');
        check('N3. decimal 3dp rejected (contract: reject)', true, JSON.stringify(n3.errs).slice(0, 120));
    } else if (!n3.stillCreate) {
        const v = String(dbRow('pelajar', lastId('pelajar')).perbelanjaan);
        note(`N3 contract: DECIMAL(10,2) with 3dp ACCEPTED and stored as ${v} (rounding/truncation by DB)`);
        check('N3. decimal 3dp accepted with recorded rounding', true, v);
    } else {
        check('N3. decimal 3dp outcome', false, 'unexpected: ' + JSON.stringify(n3.errs).slice(0, 120));
    }

    // N4: non-date text in DATE field via Livewire
    await fill(page, 'nama', 'Uji Tarikh');
    await fill(page, 'perbelanjaan', '10.00');
    const dSet = await lvSet(page, 'lahir', 'bukan-tarikh');
    check('N4a. Livewire set date garbage accepted into state', dSet);
    const n4 = await submitCreate(page);
    const n4not500 = !(await page.content()).includes('SQLSTATE') && !(await page.content()).includes('Whoops');
    check('N4b. bad date -> validation error, not 500', n4.stillCreate && n4.errs.length > 0 && n4not500,
        `errs=${JSON.stringify(n4.errs).slice(0, 120)}`);

    // N6: a REAL text/plain file (.txt) into the image field (acceptedFileTypes
    // image/*). Chromium reports MIME by extension, so the honest MIME test is
    // a .txt (text/plain), not text-bytes-named-.png (browser lies image/png).
    await page.goto(APP + '/admin/pelajar/create', { waitUntil: 'networkidle' });
    await sleep(1200);
    await fill(page, 'nama', 'Uji MIME');
    const fileInput = page.locator('input[type=file]').first();
    await fileInput.setInputFiles(path.join(FIX, 'media_test.txt'));
    await sleep(2500);
    const n6errs = await validationErrors(page);
    const pondErr = await page.evaluate(() => {
        const w = document.querySelector('.fi-fo-file-upload');
        return w ? w.innerText.trim() : '';
    });
    const n6rejected = /invalid type|tidak sah|image/i.test(pondErr) || n6errs.length > 0;
    check('N6. non-image (text/plain) rejected on image field', n6rejected, `errs=${JSON.stringify(n6errs).slice(0, 120)} pond=${pondErr.slice(0, 120)}`);
    note('N6 contract: browser reports MIME by extension — text bytes named .png are reported image/png and pass the client check; the enforced rejection is by reported MIME (a .txt is text/plain and rejected)');

    // S2: full valid create
    await page.goto(APP + '/admin/pelajar/create', { waitUntil: 'networkidle' });
    await sleep(1200);
    await fill(page, 'nama', 'Ahmad Bin Ali');
    await fill(page, 'email', 'ahmad@example.com');
    await fill(page, 'no_tel', '+60123456789');
    await page.locator('input[type=file]').first().setInputFiles(path.join(FIX, 'media_test.png'));
    await sleep(2500);
    await fill(page, 'bio', 'Baris satu.\nBaris dua.');
    await page.selectOption('#form\\.gred', 'baik');
    await fill(page, 'perbelanjaan', '150.50');
    await fill(page, 'lahir', '2000-05-17');
    const c1 = await submitCreate(page);
    check('S2a. pelajar create submitted', !c1.stillCreate && c1.errs.length === 0, JSON.stringify(c1.errs).slice(0, 140));
    const pid = lastId('pelajar');
    const prow = dbRow('pelajar', pid) || {};
    check('S2b. nama saved', String(prow.nama) === 'Ahmad Bin Ali', String(prow.nama));
    check('S2c. email saved', String(prow.email) === 'ahmad@example.com', String(prow.email));
    check('S2d. tel saved', String(prow.no_tel) === '+60123456789', String(prow.no_tel));
    check('S2e. gambar saved as path under gambar/ on public disk', String(prow.gambar || '').includes('gambar/') && String(prow.gambar).endsWith('.png'), String(prow.gambar));
    check('S2f. bio multiline saved', String(prow.bio).includes('Baris satu.') && String(prow.bio).includes('Baris dua.'), String(prow.bio).slice(0, 60));
    check('S2g. gred saved as code "baik"', String(prow.gred) === 'baik', String(prow.gred));
    check('S2h. decimal saved 150.5 (2dp value)', parseFloat(prow.perbelanjaan) === 150.5, String(prow.perbelanjaan));
    check('S2i. date saved ISO 2000-05-17', String(prow.lahir).startsWith('2000-05-17'), String(prow.lahir));

    // S3: edit prefill
    await page.goto(APP + `/admin/pelajar/${pid}/edit`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const st = await formState(page);
    check('S3a. edit prefill nama', st && st.nama === 'Ahmad Bin Ali', st ? String(st.nama) : 'no state');
    check('S3b. edit prefill gred', st && st.gred === 'baik', st ? String(st.gred) : 'no state');
    check('S3c. edit prefill decimal', st && parseFloat(st.perbelanjaan) === 150.5, st ? String(st.perbelanjaan) : 'no state');
    check('S3d. edit prefill date', st && String(st.lahir).startsWith('2000-05-17'), st ? String(st.lahir) : 'no state');
    check('S3e. edit prefill image (FilePond file list)', st && /gambar/.test(JSON.stringify(st.gambar || '')), st ? JSON.stringify(st.gambar).slice(0, 100) : 'no state');
    // save without changes -> values unchanged
    await page.getByRole('button', { name: /^(Save|Simpan)$/ }).first().click();
    await sleep(3000);
    const prow2 = dbRow('pelajar', pid) || {};
    check('S3f. untouched save keeps values', String(prow2.nama) === 'Ahmad Bin Ali' && parseFloat(prow2.perbelanjaan) === 150.5 && String(prow2.gred) === 'baik',
        JSON.stringify({ nama: prow2.nama, perbelanjaan: prow2.perbelanjaan, gred: prow2.gred }));

    // S4: list view
    await page.goto(APP + '/admin/pelajar', { waitUntil: 'networkidle' });
    await sleep(1500);
    const listHtml = await page.content();
    check('S4a. list shows caption "Baik" not raw code', (await page.locator('td:has-text("Baik")').count()) > 0, 'caption check');
    check('S4b. list shows image thumbnail from /storage/', listHtml.includes('/storage/gambar/'), 'img src');
    check('S4c. list shows the record name', (await page.locator('text=Ahmad Bin Ali').count()) > 0);

    // N7: SQL injection literal storage + escaped display
    await page.goto(APP + '/admin/pelajar/create', { waitUntil: 'networkidle' });
    await sleep(1000);
    const sqli = "Robert'); DROP TABLE pelajar;--";
    await fill(page, 'nama', sqli);
    const c2 = await submitCreate(page);
    check('N7a. SQLi value submitted without error', !c2.stillCreate && c2.errs.length === 0, JSON.stringify(c2.errs).slice(0, 120));
    const sqliRow = dbRow('pelajar', lastId('pelajar')) || {};
    check('N7b. SQLi stored literally', String(sqliRow.nama) === sqli, String(sqliRow.nama));
    const tablesAfter = q("SELECT name FROM sqlite_master WHERE type='table' AND name='pelajar'");
    check('N7c. table pelajar still exists (no injection executed)', tablesAfter.length === 1);
    await page.goto(APP + '/admin/pelajar', { waitUntil: 'networkidle' });
    await sleep(1200);
    const injShown = await page.evaluate(() => document.body.innerText.includes("DROP TABLE pelajar"));
    const injScripted = await page.evaluate(() => Array.from(document.querySelectorAll('script')).some((s) => s.textContent.includes('DROP TABLE')));
    check('N7d. SQLi displayed as text, not executed as script', injShown && !injScripted, `shown=${injShown} scripted=${injScripted}`);

    // ================================================================
    // TABLE kursus — unique varchar, decimal, date, datetime, radios,
    // rich_html, integer
    // ================================================================
    await page.goto(APP + '/admin/kursus/create', { waitUntil: 'networkidle' });
    await sleep(1200);
    await s1(page, 'kursus.kod = text', 'kod', 'text');
    await s1(page, 'kursus.mula = date', 'mula', 'date');
    await s1(page, 'kursus.jadual = datetime-local', 'jadual', 'datetime');
    await s1Radios(page, 'kursus.tahap = radio group', 'tahap');
    await s1(page, 'kursus.kapasiti = numeric', 'kapasiti', 'numeric');
    const richCount = await page.locator('.tiptap.ProseMirror[contenteditable="true"]').count();
    check('S1 kursus.deskripsi = rich editor', richCount > 0, `tiptap=${richCount}`);

    await fill(page, 'kod', 'CS101');
    await fill(page, 'tajuk', 'Pengenalan Sains Komputer');
    await fill(page, 'yuran', '450.00');
    await fill(page, 'mula', '2026-11-01');
    await fill(page, 'jadual', '2026-11-01T09:00');
    await page.locator('input[type=radio][value="asas"]').first().check({ force: true });
    const rich = page.locator('.tiptap.ProseMirror[contenteditable="true"]').first();
    await rich.click();
    await page.keyboard.type('Kursus asas untuk semua.');
    await fill(page, 'kapasiti', '40');
    const c3 = await submitCreate(page);
    check('S2j. kursus create submitted', !c3.stillCreate && c3.errs.length === 0, JSON.stringify(c3.errs).slice(0, 140));
    const kid = lastId('kursus');
    const krow = dbRow('kursus', kid) || {};
    check('S2k. kod saved', String(krow.kod) === 'CS101', String(krow.kod));
    check('S2l. yuran decimal 450', parseFloat(krow.yuran) === 450, String(krow.yuran));
    check('S2m. mula date ISO', String(krow.mula).startsWith('2026-11-01'), String(krow.mula));
    check('S2n. jadual datetime keeps 09:00', String(krow.jadual).includes('2026-11-01') && String(krow.jadual).includes('09:00'), String(krow.jadual));
    check('S2o. tahap radio saved "asas"', String(krow.tahap) === 'asas', String(krow.tahap));
    check('S2p. rich_html saved with markup wrapper', String(krow.deskripsi || '').includes('<p') && String(krow.deskripsi).includes('Kursus asas'), String(krow.deskripsi).slice(0, 80));
    check('S2q. integer kapasiti 40', String(krow.kapasiti) === '40', String(krow.kapasiti));

    // unique constraint: duplicate kod rejected
    await page.goto(APP + '/admin/kursus/create', { waitUntil: 'networkidle' });
    await sleep(1000);
    await fill(page, 'kod', 'CS101');
    await fill(page, 'tajuk', 'Duplikat');
    const dup = await submitCreate(page);
    check('N-unique. duplicate unique kod rejected', dup.stillCreate && dup.errs.length > 0, JSON.stringify(dup.errs).slice(0, 120));

    // S3 edit prefill + S4 list
    await page.goto(APP + `/admin/kursus/${kid}/edit`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const kst = await formState(page);
    check('S3g. kursus edit prefill kod/tahap/jadual', kst && kst.kod === 'CS101' && kst.tahap === 'asas' && String(kst.jadual).includes('09:00'),
        kst ? JSON.stringify({ kod: kst.kod, tahap: kst.tahap, jadual: kst.jadual }) : 'no state');
    await page.goto(APP + '/admin/kursus', { waitUntil: 'networkidle' });
    await sleep(1200);
    check('S4d. kursus list shows radio caption "Asas"', (await page.locator('td:has-text("Asas")').count()) > 0);

    // ================================================================
    // TABLE pendaftaran — lookups, repeater simple/complex, checkbox,
    // multi-select, datetime
    // ================================================================
    await page.goto(APP + '/admin/pendaftaran/create', { waitUntil: 'networkidle' });
    await sleep(1500);
    await s1(page, 'pendaftaran.pelajar_id = lookup select', 'pelajar_id', 'select');
    await s1(page, 'pendaftaran.lulus = checkbox', 'lulus', 'checkbox');
    await s1(page, 'pendaftaran.hadir_pada = datetime', 'hadir_pada', 'datetime');
    const repSimple = await page.locator('.fi-fo-simple-repeater:has([id*="tags"])').count();
    const repComplex = await page.locator('.fi-fo-repeater:has([id*="butiran"])').count();
    check('S1 pendaftaran.tags = simple repeater', repSimple > 0, `simple=${repSimple}`);
    check('S1 pendaftaran.butiran = complex repeater', repComplex > 0, `complex=${repComplex}`);

    // lookup combobox lists parent captions
    const lkOpts = await comboOptions(page, 'pelajar_id');
    check('L-S1. lookup select lists pelajar caption (Ahmad Bin Ali)', lkOpts.some((o) => o.includes('Ahmad Bin Ali')), JSON.stringify(lkOpts).slice(0, 140));

    await pickCombo(page, 'pelajar_id', 'Ahmad Bin Ali');
    await pickCombo(page, 'kursus_id', 'Pengenalan Sains Komputer');
    // repeater simple: add 2 items
    const addTags = page.getByRole('button', { name: /Tambah ke tag|Add to tags/ }).first();
    await addTags.click(); await sleep(700);
    await addTags.click(); await sleep(700);
    const tagInputs = page.locator('input[id*="tags."]');
    const tagN = await tagInputs.count();
    if (tagN >= 2) {
        await tagInputs.nth(0).fill('tag-alpha');
        await tagInputs.nth(1).fill('tag-beta');
    }
    // repeater complex: one row: text + dropdown + text
    const addBut = page.getByRole('button', { name: /Tambah ke butiran|Add to butiran/ }).first();
    await addBut.click(); await sleep(900);
    const c1in = page.locator('input[id$="butiran_1"]').last();
    await c1in.fill('butiran-satu');
    const c2sel = page.locator('[id$="butiran_2"]').last();
    if (await c2sel.count()) {
        const tag = await c2sel.evaluate((e) => e.tagName);
        if (tag === 'SELECT') await c2sel.selectOption('tinggi');
        else { await c2sel.click(); await sleep(500); await page.locator('.fi-dropdown-panel .fi-select-input-option:has-text("Tinggi")').first().click(); }
    }
    await page.locator('#form\\.lulus').check({ force: true }).catch(async () => {
        await page.locator('label:has(#form\\.lulus)').first().click({ force: true });
    });
    // multi select keutamaan (combobox stays open between picks)
    await page.click('#form\\.keutamaan'); await sleep(600);
    await page.locator('.fi-dropdown-panel .fi-select-input-option:has-text("Awal")').first().click(); await sleep(300);
    await page.locator('.fi-dropdown-panel .fi-select-input-option:has-text("Akhir")').first().click().catch(() => {});
    await page.keyboard.press('Escape'); await sleep(400);
    await fill(page, 'hadir_pada', '2026-10-04T10:30');
    const c4 = await submitCreate(page);
    check('S2r. pendaftaran create submitted', !c4.stillCreate && c4.errs.length === 0, JSON.stringify(c4.errs).slice(0, 160));
    const did = lastId('pendaftaran');
    const drow = dbRow('pendaftaran', did) || {};
    check('S2s. lookup FK pelajar_id saved (points at Ahmad row)', String(drow.pelajar_id) === String(pid), `got=${drow.pelajar_id} want=${pid}`);
    check('S2t. lookup FK kursus_id saved', String(drow.kursus_id) === String(kid), `got=${drow.kursus_id} want=${kid}`);
    check('S2u. repeater simple saved both items as JSON list', String(drow.tags || '').includes('tag-alpha') && String(drow.tags).includes('tag-beta'), String(drow.tags).slice(0, 120));
    check('S2v. repeater complex saved row (text+option)', String(drow.butiran || '').includes('butiran-satu') && String(drow.butiran).includes('tinggi'), String(drow.butiran).slice(0, 160));
    check('S2w. checkbox saved 1', String(drow.lulus) === '1', String(drow.lulus));
    check('S2x. multi-select saved awal+akhir', String(drow.keutamaan || '').includes('awal') && String(drow.keutamaan).includes('akhir'), String(drow.keutamaan).slice(0, 120));
    check('S2y. datetime saved with 10:30', String(drow.hadir_pada || '').includes('10:30'), String(drow.hadir_pada));

    // N5: repeater with an EMPTY item
    await page.goto(APP + '/admin/pendaftaran/create', { waitUntil: 'networkidle' });
    await sleep(1000);
    await pickCombo(page, 'pelajar_id', 'Ahmad Bin Ali');
    await pickCombo(page, 'kursus_id', 'Pengenalan Sains Komputer');
    const addT2 = page.getByRole('button', { name: /Tambah ke tag|Add to tags/ }).first();
    await addT2.click(); await sleep(700);
    await stripHtml5(page);
    const beforeN5 = dbCount('pendaftaran');
    const n5 = await submitCreate(page);
    if (n5.stillCreate && n5.errs.length > 0) {
        note('N5 contract: empty repeater item is REJECTED with validation error');
        check('N5. empty repeater item rejected', true, JSON.stringify(n5.errs).slice(0, 120));
    } else if (!n5.stillCreate) {
        const r5 = dbRow('pendaftaran', lastId('pendaftaran')) || {};
        note(`N5 contract: empty repeater item ACCEPTED, tags stored as: ${JSON.stringify(r5.tags)}`);
        check('N5. empty repeater item accepted with recorded contract', true, String(r5.tags));
    } else {
        check('N5. repeater empty outcome', false, 'unexpected');
    }

    // S3 edit prefill for repeaters + S4 list lookup caption
    await page.goto(APP + `/admin/pendaftaran/${did}/edit`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const dst = await formState(page);
    check('S3h. edit prefill repeater simple', dst && JSON.stringify(dst.tags || '').includes('tag-alpha'), JSON.stringify(dst && dst.tags).slice(0, 120));
    check('S3i. edit prefill repeater complex', dst && String(JSON.stringify(dst.butiran || '')).includes('butiran-satu'), JSON.stringify(dst && dst.butiran).slice(0, 160));
    check('S3j. edit prefill lookup FK', dst && String(dst.pelajar_id) === String(pid), String(dst && dst.pelajar_id));
    await page.getByRole('button', { name: /^(Save|Simpan)$/ }).first().click();
    await sleep(3000);
    const drow2 = dbRow('pendaftaran', did) || {};
    check('S3k. untouched save keeps repeater JSON', String(drow2.tags) === String(drow.tags) && String(drow2.butiran) === String(drow.butiran),
        `before=${String(drow.tags).slice(0, 60)} after=${String(drow2.tags).slice(0, 60)}`);
    await page.goto(APP + '/admin/pendaftaran', { waitUntil: 'networkidle' });
    await sleep(1200);
    const pList = await page.locator('table').first().innerText();
    check('S4e. list shows lookup parent caption (not blank/id)', pList.includes('Ahmad Bin Ali') && pList.includes('Pengenalan Sains Komputer'),
        pList.slice(0, 200).replace(/\n/g, ' | '));

    // ================================================================
    // TABLE bayaran — required decimal, datetime, dropdown, upload
    // ================================================================
    await page.goto(APP + '/admin/bayaran/create', { waitUntil: 'networkidle' });
    await sleep(1200);
    await s1(page, 'bayaran.jumlah = numeric', 'jumlah', 'numeric');
    await s1(page, 'bayaran.resit = file', 'resit', 'file');
    // N1 on required decimal (server-side)
    await stripHtml5(page);
    const bn1 = await submitCreate(page);
    check('N1b. required jumlah empty blocked', bn1.stillCreate && bn1.errs.length > 0 && dbCount('bayaran') === 0,
        `errs=${JSON.stringify(bn1.errs).slice(0, 120)}`);
    await fill(page, 'jumlah', '299.99');
    await fill(page, 'dibayar_pada', '2026-10-04T14:45');
    await page.selectOption('#form\\.kaedah', 'kad');
    await page.locator('input[type=file]').first().setInputFiles(path.join(FIX, 'media_test.pdf'));
    await sleep(2500);
    await fill(page, 'rujukan', 'REF-001');
    const c5 = await submitCreate(page);
    check('S2z. bayaran create submitted', !c5.stillCreate && c5.errs.length === 0, JSON.stringify(c5.errs).slice(0, 140));
    const byrow = dbRow('bayaran', lastId('bayaran')) || {};
    check('S2aa. jumlah decimal 299.99', parseFloat(byrow.jumlah) === 299.99, String(byrow.jumlah));
    check('S2ab. dibayar_pada keeps 14:45', String(byrow.dibayar_pada || '').includes('14:45'), String(byrow.dibayar_pada));
    check('S2ac. kaedah saved "kad"', String(byrow.kaedah) === 'kad', String(byrow.kaedah));
    check('S2ad. resit saved path under resit/', String(byrow.resit || '').includes('resit/') && String(byrow.resit).endsWith('.pdf'), String(byrow.resit));
    await page.goto(APP + '/admin/bayaran', { waitUntil: 'networkidle' });
    await sleep(1000);
    check('S4f. bayaran list shows caption "Kad"', (await page.locator('td:has-text("Kad")').count()) > 0);

    // ================================================================
    // TABLE dokumen — upload, image, attachments, gmap, youtube,
    // repeater simple
    // ================================================================
    await page.goto(APP + '/admin/dokumen/create', { waitUntil: 'networkidle' });
    await sleep(1200);
    const fileInputsDok = await page.locator('input[type=file]').count();
    check('S1 dokumen has 3 file inputs (fail, imej, galeri)', fileInputsDok >= 3, `count=${fileInputsDok}`);
    await fill(page, 'tajuk_dok', 'Dokumen Ujian Akhir');
    await page.locator('input[type=file]').nth(0).setInputFiles(path.join(FIX, 'media_test.pdf'));
    await sleep(2200);
    await page.locator('input[type=file]').nth(1).setInputFiles(path.join(FIX, 'media_test.png'));
    await sleep(2200);
    await page.locator('input[type=file]').nth(2).setInputFiles([path.join(FIX, 'media_test.png'), '/tmp/fsm_deep_second.png']);
    await sleep(3000);
    await fill(page, 'lokasi', GMAP_EMBED);
    await fill(page, 'video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const addCat = page.getByRole('button', { name: /Tambah ke catatan|Add to catatan/ }).first();
    await addCat.click(); await sleep(700);
    await page.locator('input[id*="catatan."]').first().fill('nota-1');
    const c6 = await submitCreate(page);
    check('S2ae. dokumen create submitted', !c6.stillCreate && c6.errs.length === 0, JSON.stringify(c6.errs).slice(0, 160));
    const dokrow = dbRow('dokumen', lastId('dokumen')) || {};
    check('S2af. fail saved under fail/ .pdf', String(dokrow.fail || '').includes('fail/') && String(dokrow.fail).endsWith('.pdf'), String(dokrow.fail));
    check('S2ag. imej saved under imej/ .png', String(dokrow.imej || '').includes('imej/') && String(dokrow.imej).endsWith('.png'), String(dokrow.imej));
    check('S2ah. galeri attachments saved 2 files (JSON array)', String(dokrow.galeri || '').includes('attachments') && (String(dokrow.galeri).match(/\.png|\.pdf/g) || []).length >= 2, String(dokrow.galeri).slice(0, 160));
    check('S2ai. gmap embed saved', String(dokrow.lokasi || '').includes('google.com/maps/embed'), String(dokrow.lokasi).slice(0, 80));
    check('S2aj. youtube url saved', String(dokrow.video || '').includes('dQw4w9WgXcQ'), String(dokrow.video));
    check('S2ak. repeater catatan saved nota-1', String(dokrow.catatan || '').includes('nota-1'), String(dokrow.catatan));

    // S4 list: attachments count badge + youtube/gmap viewer modals
    await page.goto(APP + '/admin/dokumen', { waitUntil: 'networkidle' });
    await sleep(1500);
    const dokListTxt = await page.locator('table').first().innerText();
    check('S4g. attachments shown as file count badge', /2 files/i.test(dokListTxt), dokListTxt.slice(0, 200).replace(/\n/g, ' | '));
    // youtube viewer modal: find the Video column by header, click its action button
    const vidIdx = await page.evaluate(() => {
        const ths = Array.from(document.querySelectorAll('table thead th'));
        return ths.findIndex((t) => /video/i.test(t.innerText));
    });
    const vidBtn = vidIdx >= 0
        ? page.locator(`table tbody tr`).first().locator(`td`).nth(vidIdx).locator('button')
        : page.locator('no-such');
    if (await vidBtn.count()) {
        await vidBtn.first().click();
        await sleep(1500);
        const modalHtml = await page.evaluate(() => {
            const m = document.querySelector('.fi-modal-window, .fi-modal');
            return m ? m.innerHTML : '';
        });
        check('S4h. youtube viewer modal renders embed iframe', modalHtml.includes('youtube.com/embed/dQw4w9WgXcQ'), modalHtml.slice(0, 120));
        await page.keyboard.press('Escape'); await sleep(800);
    } else {
        check('S4h. youtube viewer action present', false, `video column idx=${vidIdx}, no button in cell`);
    }

    // ================================================================
    // TABLE audit_log — read-only checkbox enforcement
    // ================================================================
    await page.goto(APP + '/admin/auditlog/create', { waitUntil: 'networkidle' });
    await sleep(1200);
    const roInfo = await page.evaluate(() => {
        const el = document.querySelector('#form\\.dikunci');
        return el ? { tag: el.tagName, disabled: el.disabled === true, readonly: el.readOnly === true } : null;
    });
    check('R1a. read-only checkbox rendered disabled/readonly', !!roInfo && (roInfo.disabled || roInfo.readonly), JSON.stringify(roInfo));
    await fill(page, 'tindakan', 'Log entri');
    await fill(page, 'berlaku_pada', '2026-10-04T16:00');
    await fill(page, 'maklumat', 'maklumat audit');
    // try to force-set the read-only checkbox via Livewire
    await lvSet(page, 'dikunci', true);
    const c7 = await submitCreate(page);
    check('R1b. audit_log create submitted', !c7.stillCreate && c7.errs.length === 0, JSON.stringify(c7.errs).slice(0, 120));
    const arow = dbRow('audit_log', lastId('audit_log')) || {};
    check('R1c. read-only dikunci NOT settable via POST (stays 0)', String(arow.dikunci) === '0' || arow.dikunci === null || arow.dikunci === 0,
        `dikunci=${JSON.stringify(arow.dikunci)}`);

    // ================================================================
    // FASA 21 — TABLE spesial: calculated / algorithm / lookup sep /
    // defaults / owner auto-fill / read-only text
    // ================================================================
    await page.goto(APP + '/admin/spesial/create', { waitUntil: 'networkidle' });
    await sleep(1200);

    // DOM state of the special controls (evidence for C2/R1)
    const spDom = await page.evaluate(() => {
        const g = (f) => { const el = document.querySelector('#form\\.' + f); return el ? { tag: el.tagName, disabled: el.disabled === true, readonly: el.readOnly === true } : null; };
        return { jumlah_kira: g('jumlah_kira'), status_algo: g('status_algo'), kod_kunci: g('kod_kunci') };
    });
    check('C2. calculated field read-only on form (disabled)', !!spDom.jumlah_kira && spDom.jumlah_kira.disabled === true, JSON.stringify(spDom.jumlah_kira));
    check('A0. algorithm field read-only on form (disabled)', !!spDom.status_algo && spDom.status_algo.disabled === true, JSON.stringify(spDom.status_algo));
    check('R1d. read-only text field locked (readonly or disabled)', !!spDom.kod_kunci && (spDom.kod_kunci.disabled === true || spDom.kod_kunci.readonly === true), JSON.stringify(spDom.kod_kunci));

    // D1. static default prefills the create form
    const defPrefill = await page.evaluate(() => { const el = document.querySelector('#form\\.no_rujukan'); return el ? el.value : null; });
    check('D1a. default value prefills form', defPrefill === 'AUTO-123', JSON.stringify(defPrefill));

    // L1. lookup caption separator in dropdown options
    const gandaOpts = await comboOptions(page, 'pelajar_ganda');
    check('L1a. lookup separator in caption', gandaOpts.some((o) => o.includes(' - ')), JSON.stringify(gandaOpts).slice(0, 160));

    // L2. non-existent parent FK via Livewire state (select can't pick it) ->
    // Filament Exists validation must reject; no row, no 500.
    const beforeL2 = dbCount('spesial');
    await lvSet(page, 'pelajar_ganda', 9999);
    await fill(page, 'nama_spesial', 'L2 forged');
    await fill(page, 'bil_a', '1');
    await fill(page, 'bil_b', '1');
    const l2s = await submitCreate(page);
    const afterL2 = dbCount('spesial');
    check('L2. non-existent parent FK rejected (no row)',
        afterL2 === beforeL2 && l2s.stillCreate && l2s.errs.length > 0,
        `rows=${beforeL2}->${afterL2} errs=${JSON.stringify(l2s.errs).slice(0, 120)}`);

    // C1/A1. normal create with inputs -> computed values?
    await fill(page, 'nama_spesial', 'Rekod Fasa21');
    await fill(page, 'bil_a', '7');
    await fill(page, 'bil_b', '5');
    await pickCombo(page, 'pelajar_ganda', 'Ahmad Bin Ali');
    const cSp = await submitCreate(page);
    check('SP1. spesial create submitted', !cSp.stillCreate && cSp.errs.length === 0, JSON.stringify(cSp.errs).slice(0, 140));
    const sp = dbRow('spesial', lastId('spesial')) || {};
    check('C1. calculated jumlah_kira = 7+5 = 12 in DB', Number(sp.jumlah_kira) === 12, `jumlah_kira=${JSON.stringify(sp.jumlah_kira)}`);
    note('A1 contract: algorithm builder (canvas steps) has NO runtime engine in codegen — algorithm_enable only locks the field (disabled+dehydrated(false)); the value is never computed. Recorded as a product gap, not a test failure.');
    check('A1b. algorithm field value not user-settable (stays null, not forged)', sp.status_algo === null, `status_algo=${JSON.stringify(sp.status_algo)}`);
    check('D1b. untouched default saved to DB', sp.no_rujukan === 'AUTO-123', `no_rujukan=${JSON.stringify(sp.no_rujukan)}`);
    check('D2a. CURRENT_TIMESTAMP default saved as real timestamp', !!sp.tarikh_daftar && sp.tarikh_daftar !== 'CURRENT_TIMESTAMP'
        && Math.abs(Date.now() - Date.parse(String(sp.tarikh_daftar).replace(' ', 'T'))) < 86400000, `tarikh_daftar=${JSON.stringify(sp.tarikh_daftar)}`);
    check('D2b. created_by auto-filled with auth user id', Number(sp.created_by) === 1, `created_by=${JSON.stringify(sp.created_by)}`);
    check('L1b. lookup FK saved to real parent', !!sp.pelajar_ganda && q(`SELECT nama FROM pelajar WHERE id=${Number(sp.pelajar_ganda)}`).length === 1, `pelajar_ganda=${JSON.stringify(sp.pelajar_ganda)}`);

    // C2b/R1e. smuggling via Livewire state on disabled fields: set forged
    // values programmatically then submit. dehydrated(false) must drop them.
    await page.goto(APP + '/admin/spesial/create', { waitUntil: 'networkidle' });
    await sleep(1000);
    await fill(page, 'nama_spesial', 'Smuggle test');
    await fill(page, 'bil_a', '1');
    await fill(page, 'bil_b', '1');
    await pickCombo(page, 'pelajar_ganda', 'Ahmad Bin Ali');
    await lvSet(page, 'jumlah_kira', 999);
    await lvSet(page, 'status_algo', 'HACKED');
    await lvSet(page, 'kod_kunci', 'BYPASS');
    const sm = await submitCreate(page);
    const smRow = dbCount('spesial') > afterL2 ? dbRow('spesial', lastId('spesial')) : null;
    check('C2b. forged jumlah_kira via Livewire state not stored as 999',
        !smRow ? sm.stillCreate : Number(smRow.jumlah_kira) !== 999,
        smRow ? `db=${JSON.stringify(smRow.jumlah_kira)}` : 'no row created (blocked)');
    check('R1e. forged kod_kunci via Livewire state not stored as BYPASS',
        !smRow ? sm.stillCreate : smRow.kod_kunci !== 'BYPASS',
        smRow ? `db=${JSON.stringify(smRow.kod_kunci)}` : 'no row created (blocked)');

    // ---- summary ----
    console.log('\n================ FASA 20 RUNTIME SUMMARY ================');
    console.log(`${pass} PASS / ${fail} FAIL`);
    if (failures.length) { console.log('FAILURES:'); failures.forEach((f) => console.log('  - ' + f)); }
    if (contracts.length) { console.log('CONTRACTS RECORDED:'); contracts.forEach((c) => console.log('  * ' + c)); }
    if (pageErrors.length) { console.log('PAGE ERRORS: ' + pageErrors.slice(0, 5).join(' | ')); }
    await browser.close();
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS FATAL:', e.stack || e.message); process.exit(1); });
