// Live browser test for the generated PUBLIC intake form (/f/{slug}).
// Exercises every control type through a REAL Chromium browser:
// render -> validation (client+server) -> submit -> DB -> lookup.
// Requires: node test/boot_pubform_app.js + artisan serve on 8902.
// Usage: node test/public_form_live_test.js
'use strict';
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');
const { execSync } = require('child_process');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8902';
const APP = '/tmp/fsm-pubform-app';
let pass = 0, fail = 0;
function check(name, ok, extra = '') {
    if (ok) { pass++; console.log('  PASS  ' + name); }
    else { fail++; console.log('  FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function capAnswer(capText) {
    const m = String(capText).match(/(\d+)\s*\+\s*(\d+)/);
    return String(Number(m[1]) + Number(m[2]));
}
function q(sql) {
    return execSync(`sqlite3 ${APP}/database/database.sqlite "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

(async () => {
    // Reset rate-limiter state and rows from previous runs (throttle keys
    // live in cache; count assertions need empty tables).
    execSync('php artisan cache:clear --quiet', { cwd: APP });
    execSync('sqlite3 database/database.sqlite "DELETE FROM aduan; DELETE FROM ringkas;"', { cwd: APP });
    const browser = await chromium.launch({ executablePath: resolveChrome() });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();

    console.log('--- 1. Route + render matrix (/f/aduan) ---');
    let resp = await page.goto(BASE + '/f/aduan');
    check('GET /f/aduan = 200', resp.status() === 200, 'status=' + resp.status());
    const html = await page.content();
    check('intro text rendered', html.includes('Lodge your complaint here'));
    check('honeypot present', html.includes('name="website"'));
    check('text input (Full Name)', (await page.locator('#fld-txt_plain').count()) === 1);
    check('email input type=email', await page.getAttribute('#fld-txt_email', 'type') === 'email');
    check('textarea for text_area', (await page.locator('textarea#fld-txt_area').count()) === 1);
    check('textarea for rich_html', (await page.locator('textarea#fld-txt_rich').count()) === 1);
    check('checkbox for check_box', (await page.locator('input#fld-bool_urgent[type=checkbox]').count()) === 1);
    check('checkbox has hidden 0 fallback', (await page.locator('input[type=hidden][name=bool_urgent]').count()) === 1);
    check('select for options dropdown', (await page.locator('select#fld-opt_category option').count()) === 4); // blank + 3
    check('multiselect renders 3 checkboxes', (await page.locator('input[name="opt_channels[]"]').count()) === 3);
    check('radios for options radios', (await page.locator('input[name="opt_priority"]').count()) === 3);
    const lkOpts = await page.locator('select#fld-lk_watak option').allTextContents();
    check('lookup select has seeded parents', lkOpts.some((t) => t.includes('Watak Satu')) && lkOpts.some((t) => t.includes('Watak Tiga')), lkOpts.join('|'));
    const lkRadioVals = await page.locator('input[name="lk_watak_radio"]').evaluateAll((els) => els.map((e) => e.value));
    check('lookup radios has 3 parent ids', lkRadioVals.length === 3 && lkRadioVals.includes('1'), lkRadioVals.join(','));
    check('repeater row + add button', (await page.locator('.rep[data-field=rep_notes] .rep-row').count()) >= 1 && (await page.locator('.rep-add').count()) === 1);
    check('decimal input step=0.01', await page.getAttribute('#fld-num_amount', 'step') === '0.01');
    check('date input type=date', await page.getAttribute('#fld-dt_event', 'type') === 'date');
    check('datetime input type=datetime-local', await page.getAttribute('#fld-dt_report', 'type') === 'datetime-local');
    check('image upload control (accept image/*)', (await page.locator('input#fld-img_proof[type=file][accept="image/*"]').count()) === 1);
    check('file upload control (accept .pdf,.txt)', (await page.locator('input#fld-doc_form[type=file][accept=".pdf,.txt"]').count()) === 1);
    check('multi attachments control', (await page.locator('input#fld-files_extra[type=file][multiple]').count()) === 1);
    check('gmap embed text control', (await page.locator('input#fld-map_place[type=text]').count()) === 1);
    check('youtube embed text control', (await page.locator('input#fld-vid_evidence[type=text]').count()) === 1);
    check('form enctype multipart', (await page.getAttribute('form', 'enctype')) === 'multipart/form-data');
    check('captcha question shown', html.includes('Human check'));
    check('lookup link shown', html.includes('/f/aduan/status'));
    check('non-allowed field absent (internal_note)', !html.includes('fld-internal_note'));

    console.log('--- 2. Unknown slug / lookup-disabled 404s ---');
    resp = await page.goto(BASE + '/f/doesnotexist');
    check('unknown slug = 404', resp.status() === 404, 'status=' + resp.status());
    resp = await page.goto(BASE + '/f/ringkas/status');
    check('lookup disabled = 404', resp.status() === 404, 'status=' + resp.status());

    console.log('--- 3. Required-field validation (empty submit, correct captcha) ---');
    await page.goto(BASE + '/f/aduan');
    await page.fill('#captcha', capAnswer(await page.locator('label[for=captcha]').textContent()));
    await page.click('button[type=submit]');
    await page.waitForLoadState('load');
    const errHtml = await page.content();
    check('required error on Full Name', errHtml.includes('The Full Name field is required'), (errHtml.match(/err">[^<]+/g) || []).slice(0, 3).join(' | '));
    check('required error on Email', errHtml.includes('The Email field is required'));
    check('no row inserted', q('SELECT COUNT(*) FROM aduan;') === '0');

    console.log('--- 4. Bad email rejected (server-side; browser native check also blocks) ---');
    {
        execSync('php artisan cache:clear --quiet', { cwd: APP });
        await page.goto(BASE + '/f/aduan');
        const token = await page.locator('input[name=_token]').inputValue();
        const cap = await page.locator('label[for=captcha]').textContent();
        const ans = capAnswer(cap);
        const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
        const r = await ctx.request.post(BASE + '/f/aduan', {
            headers: { cookie, 'X-CSRF-TOKEN': token, Referer: BASE + '/f/aduan' },
            form: { _token: token, txt_plain: 'Mail Test', txt_email: 'not-an-email', captcha: ans },
            maxRedirects: 0,
        });
        const loc = r.headers()['location'] || '';
        check('bad email rejected server-side (302 back, no success)', r.status() === 302 && !loc.includes('success'), r.status() + ' ' + loc);
        check('bad email row NOT inserted', q("SELECT COUNT(*) FROM aduan WHERE txt_plain='Mail Test';") === '0');
    }

    console.log('--- 5. Forged option value rejected (server-side in: rule) ---');
    // Bypass the <select> UI by POSTing a forged value directly with the session's CSRF token.
    {
        await page.goto(BASE + '/f/aduan');
        const token = await page.locator('input[name=_token]').inputValue();
        const cap = await page.locator('label[for=captcha]').textContent();
        const m = cap.match(/(\d+)\s*\+\s*(\d+)/);
        const ans = Number(m[1]) + Number(m[2]);
        const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
        const r = await ctx.request.post(BASE + '/f/aduan', {
            headers: { cookie, 'X-CSRF-TOKEN': token, Referer: BASE + '/f/aduan' },
            form: { _token: token, txt_plain: 'Forge Test', txt_email: 'forge@example.com', opt_category: 'HACKED', captcha: String(ans) },
            maxRedirects: 0,
        });
        const loc = r.headers()['location'] || '';
        check('forged option rejected (302 back with errors)', r.status() === 302 && loc.includes('/f/aduan') && !loc.includes('success'), r.status() + ' ' + loc);
        check('forged row NOT inserted', q("SELECT COUNT(*) FROM aduan WHERE txt_plain='Forge Test';") === '0');
    }

    console.log('--- 6. Forged FK value rejected (exists: rule) ---');
    {
        await page.goto(BASE + '/f/aduan');
        const token = await page.locator('input[name=_token]').inputValue();
        const cap = await page.locator('label[for=captcha]').textContent();
        const m = cap.match(/(\d+)\s*\+\s*(\d+)/);
        const ans = Number(m[1]) + Number(m[2]);
        const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
        const r = await ctx.request.post(BASE + '/f/aduan', {
            headers: { cookie, 'X-CSRF-TOKEN': token, Referer: BASE + '/f/aduan' },
            form: { _token: token, txt_plain: 'FK Forge', txt_email: 'fkforge@example.com', lk_watak: '9999', captcha: String(ans) },
            maxRedirects: 0,
        });
        const loc = r.headers()['location'] || '';
        check('forged FK rejected (302 back)', r.status() === 302 && !loc.includes('success'), r.status() + ' ' + loc);
        check('forged FK row NOT inserted', q("SELECT COUNT(*) FROM aduan WHERE txt_plain='FK Forge';") === '0');
    }

    console.log('--- 7. Wrong captcha rejected ---');
    {
        await page.goto(BASE + '/f/aduan');
        const token = await page.locator('input[name=_token]').inputValue();
        const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
        const r = await ctx.request.post(BASE + '/f/aduan', {
            headers: { cookie, 'X-CSRF-TOKEN': token, Referer: BASE + '/f/aduan' },
            form: { _token: token, txt_plain: 'Cap Fail', txt_email: 'capfail@example.com', captcha: '99' },
            maxRedirects: 0,
        });
        const loc = r.headers()['location'] || '';
        check('wrong captcha bounces back to form', r.status() === 302 && !loc.includes('success'), r.status() + ' ' + loc);
    }

    console.log('--- 8. Honeypot silently drops ---');
    {
        await page.goto(BASE + '/f/aduan');
        const token = await page.locator('input[name=_token]').inputValue();
        const cap = await page.locator('label[for=captcha]').textContent();
        const m = cap.match(/(\d+)\s*\+\s*(\d+)/);
        const ans = Number(m[1]) + Number(m[2]);
        const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
        const r = await ctx.request.post(BASE + '/f/aduan', {
            headers: { cookie, 'X-CSRF-TOKEN': token, Referer: BASE + '/f/aduan' },
            form: { _token: token, txt_plain: 'Bot', txt_email: 'bot@example.com', website: 'http://spam.example', captcha: String(ans) },
            maxRedirects: 0,
        });
        const loc = r.headers()['location'] || '';
        check('honeypot redirects to fake success', r.status() === 302 && loc.includes('ref=submitted'), r.status() + ' ' + loc);
        check('honeypot row NOT inserted', q("SELECT COUNT(*) FROM aduan WHERE txt_plain='Bot';") === '0');
    }

    console.log('--- 9. Full valid submit through the UI (every control) ---');
    execSync('php artisan cache:clear --quiet', { cwd: APP });
    await page.goto(BASE + '/f/aduan');
    await page.fill('#fld-txt_plain', 'Ali Bin Test');
    await page.fill('#fld-txt_email', 'ali.test@example.com');
    await page.fill('#fld-txt_area', 'Item broken at counter 3.');
    await page.fill('#fld-txt_rich', '<b>Rich</b> details here');
    await page.check('#fld-bool_urgent');
    await page.selectOption('#fld-opt_category', 'rosak');
    await page.check('input[name="opt_channels[]"][value="email"]');
    await page.check('input[name="opt_channels[]"][value="sms"]');
    await page.check('input[name="opt_priority"][value="tinggi"]');
    await page.selectOption('#fld-lk_watak', { label: 'Watak Dua' });
    await page.check('input[name="lk_watak_radio"][value="3"]');
    // repeater: fill first row, add a second
    await page.fill('.rep[data-field=rep_notes] .rep-row input', 'note one');
    await page.click('.rep-add');
    await page.fill('.rep[data-field=rep_notes] .rep-row:nth-child(2) input', 'note two');
    await page.fill('#fld-num_amount', '123.45');
    await page.fill('#fld-dt_event', '2026-10-15');
    await page.fill('#fld-dt_report', '2026-10-01T14:30');
    await page.setInputFiles('#fld-img_proof', 'test/fixtures/media_test.png');
    await page.setInputFiles('#fld-doc_form', 'test/fixtures/media_test.pdf');
    await page.setInputFiles('#fld-files_extra', ['test/fixtures/media_test.pdf', 'test/fixtures/media_test.txt']);
    await page.fill('#fld-map_place', '<iframe src="https://maps.google.com/maps?q=KL&output=embed" width="600" height="450"></iframe>');
    await page.fill('#fld-vid_evidence', '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315"></iframe>');
    const cap2 = await page.locator('label[for=captcha]').textContent();
    const m2 = cap2.match(/(\d+)\s*\+\s*(\d+)/);
    await page.fill('#captcha', String(Number(m2[1]) + Number(m2[2])));
    await page.click('button[type=submit]');
    try {
        await page.waitForURL('**/success**', { timeout: 10000 });
    } catch (e) {
        const errs = (await page.content()).match(/err">[^<]+/g) || [];
        check('valid submit reaches success page', false, 'stuck at ' + page.url() + ' errors: ' + errs.join(' | '));
        throw e;
    }
    const url = new URL(page.url());
    const ref = url.searchParams.get('ref');
    check('redirected to success with PF- reference', !!ref && ref.startsWith('PF-'), 'ref=' + ref);
    const successHtml = await page.content();
    check('success text shown', successHtml.includes('reviewed'));
    check('reference shown on success page', ref && successHtml.includes(ref));

    const row = q(`SELECT txt_plain,txt_email,txt_area,txt_rich,bool_urgent,opt_category,opt_channels,opt_priority,lk_watak,lk_watak_radio,rep_notes,num_amount,dt_event,dt_report,aduan_status,public_reference,img_proof,doc_form,files_extra,map_place,vid_evidence FROM aduan WHERE public_reference='${ref}';`);
    check('row inserted with reference', row !== '');
    const cols = row.split('|');
    check('txt_plain saved', cols[0] === 'Ali Bin Test', cols[0]);
    check('txt_email saved', cols[1] === 'ali.test@example.com', cols[1]);
    check('textarea saved', cols[2] === 'Item broken at counter 3.', cols[2]);
    check('rich_html saved as text', cols[3] === '<b>Rich</b> details here', cols[3]);
    check('checkbox saved as 1', cols[4] === '1', cols[4]);
    check('option dropdown saved', cols[5] === 'rosak', cols[5]);
    check('multiselect saved as JSON array', cols[6] === '["email","sms"]', cols[6]);
    check('radios saved', cols[7] === 'tinggi', cols[7]);
    const watakDuaId = q("SELECT id FROM watak WHERE nama_watak='Watak Dua';");
    check('FK dropdown saved parent id', cols[8] === watakDuaId, cols[8] + ' vs ' + watakDuaId);
    check('FK radios saved parent id 3', cols[9] === '3', cols[9]);
    check('repeater saved as JSON array', cols[10] === '["note one","note two"]', cols[10]);
    check('decimal saved exactly', cols[11] === '123.45', cols[11]);
    check('date saved', cols[12] === '2026-10-15', cols[12]);
    check('datetime saved with time', cols[13].startsWith('2026-10-01 14:30'), cols[13]);
    check('status default = pending', cols[14] === 'pending', cols[14]);
    check('image path saved (public-form dir)', (cols[16] || '').startsWith('public-form/aduan/img_proof/'), cols[16]);
    check('doc path saved', (cols[17] || '').startsWith('public-form/aduan/doc_form/'), cols[17]);
    let attPaths = [];
    try { attPaths = JSON.parse(cols[18] || '[]'); } catch (e) { /* below catches it */ }
    check('attachments saved as JSON array of 2 paths', Array.isArray(attPaths) && attPaths.length === 2 && attPaths.every((pth) => pth.startsWith('public-form/aduan/files_extra/')), cols[18]);
    check('gmap embed code saved verbatim', (cols[19] || '').includes('maps.google.com'), (cols[19] || '').slice(0, 60));
    check('youtube embed code saved verbatim', (cols[20] || '').includes('youtube.com/embed'), (cols[20] || '').slice(0, 60));
    // files actually landed on disk
    const imgOnDisk = execSync(`ls storage/app/public/${cols[16]}`, { cwd: APP, encoding: 'utf8' }).trim() !== '';
    check('image file exists on public disk', imgOnDisk, cols[16]);
    const docOnDisk = execSync(`ls storage/app/public/${cols[17]}`, { cwd: APP, encoding: 'utf8' }).trim() !== '';
    check('doc file exists on public disk', docOnDisk, cols[17]);
    const attOnDisk = attPaths.every((pth) => { try { return execSync(`ls storage/app/private/${pth}`, { cwd: APP, encoding: 'utf8' }).trim() !== ''; } catch (e) { return false; } });
    check('attachment files exist on local disk', attOnDisk, attPaths.join(','));

    console.log('--- 9b. Media validation negatives (server-side) ---');
    {
        execSync('php artisan cache:clear --quiet', { cwd: APP });
        await page.goto(BASE + '/f/aduan');
        const token = await page.locator('input[name=_token]').inputValue();
        const ans = capAnswer(await page.locator('label[for=captcha]').textContent());
        const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
        // text file forged as image -> 'image' rule must reject
        const r1 = await ctx.request.post(BASE + '/f/aduan', {
            headers: { cookie, 'X-CSRF-TOKEN': token, Referer: BASE + '/f/aduan' },
            multipart: {
                _token: token, txt_plain: 'Media Neg', txt_email: 'medianeg@example.com', captcha: ans,
                img_proof: { name: 'fake.png', mimeType: 'text/plain', buffer: fs.readFileSync('test/fixtures/media_test.txt') },
            },
            maxRedirects: 0,
        });
        check('non-image rejected by image rule (302 back)', r1.status() === 302 && !(r1.headers()['location'] || '').includes('success'), r1.status() + ' ' + (r1.headers()['location'] || ''));
        check('forged-image row NOT inserted', q("SELECT COUNT(*) FROM aduan WHERE txt_plain='Media Neg';") === '0');
        // .txt uploaded to a pdf,txt field is valid; .png to that field must fail mimes
        const r2 = await ctx.request.post(BASE + '/f/aduan', {
            headers: { cookie, 'X-CSRF-TOKEN': token, Referer: BASE + '/f/aduan' },
            multipart: {
                _token: token, txt_plain: 'Mime Neg', txt_email: 'mimeneg@example.com', captcha: ans,
                img_proof: { name: 'ok.png', mimeType: 'image/png', buffer: fs.readFileSync('test/fixtures/media_test.png') },
                doc_form: { name: 'wrong.png', mimeType: 'image/png', buffer: fs.readFileSync('test/fixtures/media_test.png') },
            },
            maxRedirects: 0,
        });
        check('wrong-extension doc rejected by mimes rule', r2.status() === 302 && !(r2.headers()['location'] || '').includes('success'), r2.status() + ' ' + (r2.headers()['location'] || ''));
        check('mimes-violation row NOT inserted', q("SELECT COUNT(*) FROM aduan WHERE txt_plain='Mime Neg';") === '0');
    }

    console.log('--- 10. Public status lookup ---');
    await page.goto(BASE + '/f/aduan/status');
    await page.fill('#reference', ref);
    await page.fill('#email', 'ali.test@example.com');
    await page.click('button[type=submit]');
    await page.waitForLoadState('load');
    const look = await page.content();
    check('lookup found: reference echoed', look.includes(ref));
    check('lookup found: status pending badge', look.includes('Pending'));
    check('lookup found: last updated shown', look.includes('Last updated'));
    // wrong email must not match
    await page.goto(BASE + '/f/aduan/status');
    await page.fill('#reference', ref);
    await page.fill('#email', 'wrong@example.com');
    await page.click('button[type=submit]');
    await page.waitForLoadState('load');
    check('lookup wrong email = no match', (await page.content()).includes('No matching submission'));

    console.log('--- 11. Second form /f/ringkas (no captcha, no lookup) ---');
    await page.goto(BASE + '/f/ringkas');
    const rHtml = await page.content();
    check('ringkas renders without captcha', !rHtml.includes('Human check'));
    check('ringkas has no lookup link', !rHtml.includes('/f/ringkas/status'));
    await page.fill('#fld-nota', 'Quick hello');
    await page.click('button[type=submit]');
    await page.waitForURL('**/ringkas/success**', { timeout: 10000 });
    check('ringkas submitted', q("SELECT nota FROM ringkas WHERE nota='Quick hello';") === 'Quick hello');

    console.log('--- 12. Throttle (>5 submissions/min/IP) ---');
    {
        await page.goto(BASE + '/f/ringkas');
        const token = await page.locator('input[name=_token]').inputValue();
        const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
        let throttled = false;
        for (let i = 0; i < 8; i++) {
            const r = await ctx.request.post(BASE + '/f/ringkas', {
                headers: { cookie, 'X-CSRF-TOKEN': token, Referer: BASE + '/f/ringkas' },
                form: { _token: token, nota: 'spam ' + i },
                maxRedirects: 0,
            });
            const loc = r.headers()['location'] || '';
            if (r.status() === 429) { throttled = true; break; }
            // Laravel back() with errors = 302; detect throttle by following to see error
            if (r.status() === 302) {
                const page2 = await ctx.newPage();
                await page2.goto(new URL(loc, BASE).toString(), { waitUntil: 'load' });
                if ((await page2.content()).includes('Too many submissions')) { await page2.close(); throttled = true; break; }
                await page2.close();
            }
        }
        check('throttle kicks in after burst', throttled);
    }

    console.log('--- 13. Mobile viewport (390x844) no horizontal overflow ---');
    const mob = await ctx.newPage();
    await mob.setViewportSize({ width: 390, height: 844 });
    await mob.goto(BASE + '/f/aduan');
    const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('no horizontal scroll on mobile', overflow === 0, 'overflow=' + overflow);
    const fontSz = await mob.evaluate(() => getComputedStyle(document.querySelector('#fld-txt_plain')).fontSize);
    check('mobile input font >= 16px (iOS zoom guard)', parseFloat(fontSz) >= 16, fontSz);

    await browser.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(2); });
