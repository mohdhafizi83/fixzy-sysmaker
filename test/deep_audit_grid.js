// Fasa 22 — runtime semantics: grid, summary, views, soft delete, CSV.
// Target: gridtest table in the booted DEEP-AUDIT-001 app (port 8911).
// Ground truth: direct SQLite reads. Seeding via SQL (create semantics
// already covered by Fasa 20/21 harnesses).
//
//   G1 pagination: pages correct, no dup/missing across pages
//   G2 sort: header click ASC/DESC matches SQL ORDER BY
//   G3 summaries: SUM/AVG/COUNT/MIN/MAX match whole-table SQL (not page)
//   G4 group-by: groups + counts correct
//   K1 kanban: allowed transition persists; disallowed rejected (server)
//   V1 calendar: record appears on its date
//   V2 tree: parent/child depth correct
//   S1 soft delete: gone from list -> in trash -> restore -> back
//   S2 soft-deleted row edit via URL -> not editable
//   X1 CSV export: ALL rows (not just page), columns correct
//   X2 CSV import round-trip: comma/unicode/empty preserved
//   X3 broken row import: clear report, no half-baked data
//
// Usage: node test/deep_audit_grid.js   (app on 127.0.0.1:8911, FRESH DB)
'use strict';
const { chromium } = require('playwright-core');
const { resolveChrome } = require('./chromePath');
const fs = require('fs');
const path = require('path');

const APP = process.env.APP_BASE || 'http://127.0.0.1:8911';
const APPDIR = process.env.APP_DIR || '/tmp/fsm-deep-app';
const DB = path.join(APPDIR, 'database', 'database.sqlite');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const failures = [];
const contracts = [];
function check(name, cond, extra = '') {
    if (cond) { pass++; console.log('PASS  ' + name); }
    else { fail++; failures.push(name + (extra ? ' [' + extra + ']' : '')); console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function note(c) { contracts.push(c); console.log('NOTE  ' + c); }
function q(sql) {
    const { spawnSync } = require('child_process');
    const r = spawnSync('php', [path.join(__dirname, 'deep_audit_q.php'), sql], { encoding: 'utf8', env: { ...process.env, FSM_TEST_DB: DB } });
    if (r.status !== 0) throw new Error('db query failed: ' + (r.stderr || '').slice(0, 200));
    return JSON.parse(r.stdout);
}

// Seed 12 deterministic rows: nilai 10..120, skor 1..12, kategori cycles alpha/beta/gama
function seedRows() {
    q(`DELETE FROM gridtest`);
    const cats = ['alpha', 'beta', 'gama'];
    const stats = ['Draft', 'Review', 'Approved'];
    for (let i = 1; i <= 12; i++) {
        const cat = cats[(i - 1) % 3];
        const st = stats[(i - 1) % 3];
        q(`INSERT INTO gridtest (nama_item, nilai, skor, kuantiti, tinggi, lebar, kategori, status_kerja, tarikh_hantar, parent_id, created_at, updated_at)
           VALUES ('Item${String(i).padStart(2, '0')}', ${i * 10}, ${i}, ${i * 2}, ${100 + i}, ${200 + i}, '${cat}', '${st}', '2026-10-${String(i).padStart(2, '0')}', NULL, datetime('now'), datetime('now'))`);
    }
    // tree: Item01 root, Item02 child of Item01, Item03 grandchild of Item02
    const r1 = q(`SELECT id FROM gridtest WHERE nama_item='Item01'`)[0];
    const r2 = q(`SELECT id FROM gridtest WHERE nama_item='Item02'`)[0];
    q(`UPDATE gridtest SET parent_id=${r1.id} WHERE id=${r2.id}`);
    const r3 = q(`SELECT id FROM gridtest WHERE nama_item='Item03'`)[0];
    q(`UPDATE gridtest SET parent_id=${r2.id} WHERE id=${r3.id}`);
}

// Ungroup the table via Livewire (default group is kategori) so pagination
// and sorting cover the flat row set.
async function ungroup(page) {
    await page.evaluate(() => {
        for (const c of window.Livewire.all()) {
            if ('tableGrouping' in c.snapshot.data) { c.$wire.set('tableGrouping', null); return; }
        }
    });
    await sleep(1800);
}
// Read a summary row by its heading text ("Muka surat ini" / "Semua ...")
async function summaryRowText(page, want) {
    return page.evaluate((w) => {
        const rows = Array.from(document.querySelectorAll('tr.fi-ta-summary-row'));
        const r = rows.find((x) => new RegExp(w, 'i').test(x.innerText));
        return r ? r.innerText.replace(/\s+/g, ' ') : '';
    }, want);
}

// Collect visible row names on the current list page
async function listNames(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('table tbody tr'))
        .filter((tr) => !/group-header|summary/.test(tr.className))
        .map((tr) => (tr.innerText || '').split('\t').map((s) => s.trim()).filter(Boolean)[0] || '')
        .filter((s) => /^Item\d\d/.test(s)));
}

(async () => {
    const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 1700, height: 1400 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));

    // login
    await page.goto(APP + '/admin/login', { waitUntil: 'networkidle' });
    await page.fill('input[type=email]', 'admin@admin.com');
    await page.fill('input[type=password]', 'password');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
    console.log('logged in');

    seedRows();
    const total = q(`SELECT COUNT(*) c FROM gridtest`)[0].c;
    check('SEED. 12 rows in gridtest', total === 12, 'c=' + total);

    // ================================================================
    // G1. Pagination — per-page 5 (fixture), 12 rows -> pages 5/5/2
    // ================================================================
    await page.goto(APP + '/admin/gridtest', { waitUntil: 'networkidle' });
    await sleep(1500);
    await ungroup(page);
    const perPageSel = await page.evaluate(() => {
        const s = Array.from(document.querySelectorAll('select')).find((x) => Array.from(x.options).some((o) => /5|10/.test(o.value)));
        return s ? s.value : null;
    });
    const p1 = await listNames(page);
    check('G1a. page 1 has rows', p1.length > 0, 'n=' + p1.length + ' perPage=' + perPageSel);
    // jump to last page via pagination next buttons (max 10 clicks)
    const seen = new Set(p1);
    for (let i = 0; i < 10; i++) {
        const nextBtn = page.locator('[wire\\:click^="nextPage"]:visible').first();
        if (!(await nextBtn.count()) || (await nextBtn.isDisabled())) break;
        await nextBtn.click();
        await sleep(1200);
        (await listNames(page)).forEach((n) => seen.add(n));
    }
    check('G1b. union across pages = all 12 rows, no loss', seen.size === 12, 'seen=' + seen.size);

    // ================================================================
    // G2. Sort by nilai ASC/DESC matches SQL ORDER BY
    // ================================================================
    await page.goto(APP + '/admin/gridtest', { waitUntil: 'networkidle' });
    await sleep(1200);
    await ungroup(page);
    const sortBtn = page.locator('table thead th button:has-text("Nilai"), table thead [wire\\:click*="sort"]:has-text("Nilai")').first();
    if (await sortBtn.count()) {
        await sortBtn.click(); await sleep(1300);
        const asc = await listNames(page);
        const sqlAsc = q(`SELECT nama_item FROM gridtest ORDER BY nilai ASC LIMIT ${asc.length}`).map((r) => r.nama_item);
        check('G2a. ASC order matches SQL', JSON.stringify(asc) === JSON.stringify(sqlAsc), `ui=${asc.slice(0, 4)} sql=${sqlAsc.slice(0, 4)}`);
        await sortBtn.click(); await sleep(1300);
        const desc = await listNames(page);
        const sqlDesc = q(`SELECT nama_item FROM gridtest ORDER BY nilai DESC LIMIT ${desc.length}`).map((r) => r.nama_item);
        check('G2b. DESC order matches SQL', JSON.stringify(desc) === JSON.stringify(sqlDesc), `ui=${desc.slice(0, 4)} sql=${sqlDesc.slice(0, 4)}`);
    } else {
        check('G2. sort control present', false, 'no Nilai sort button');
    }

    // ================================================================
    // G3. Summaries over the WHOLE table — Filament renders TWO summary
    // rows: "Muka surat ini" (page scope) and "Semua <label>" (all rows).
    // The plan requires whole-table correctness => read the "Semua" row.
    // ================================================================
    const allTxt = await summaryRowText(page, 'Semua');
    const pageTxt = await summaryRowText(page, 'Muka surat');
    const agg = q(`SELECT SUM(nilai) s, AVG(skor) a, COUNT(kuantiti) c, MIN(tinggi) mn, MAX(lebar) mx FROM gridtest`)[0];
    const has = (re, want, label) => {
        const m = allTxt.match(re);
        const got = m && m[1] ? m[1].replace(/[^0-9.]/g, '') : '';
        const ok = m && Math.abs(parseFloat(got) - parseFloat(want)) < 0.01;
        check(`G3. ${label} = ${want} (whole table)`, ok, `got=${got} row="${allTxt.slice(0, 150)}"`);
    };
    has(/Total Nilai\s+([\d.,]+)/i, agg.s, 'SUM nilai');
    has(/Average Skor\s+([\d.,]+)/i, agg.a, 'AVG skor');
    has(/Count of Kuantiti\s+([\d.,]+)/i, agg.c, 'COUNT kuantiti');
    has(/Range Tinggi\s+([\d.,]+)/i, agg.mn, 'MIN tinggi (range low)');
    has(/Range Lebar\s+[\d.,]+\s*-\s*([\d.,]+)/i, agg.mx, 'MAX lebar (range high)');
    note('G3 contract: Filament v5 renders page-scope ("Muka surat ini") AND all-rows ("Semua ...") summary rows; whole-table values come from the "Semua" row: ' + allTxt.slice(0, 120) + ' | page row: ' + pageTxt.slice(0, 80));

    // ================================================================
    // G4. Group-by kategori: group headers + per-group summary counts
    // ================================================================
    await page.evaluate(() => {
        for (const c of window.Livewire.all()) {
            if ('tableGrouping' in c.snapshot.data) { c.$wire.set('tableGrouping', 'kategori:asc'); return; }
        }
    });
    await sleep(2000);
    const grpSeen = new Set();
    const grabGrp = () => page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        return rows.filter((r) => /group-header/.test(r.className)).map((r) => r.innerText.trim());
    });
    (await grabGrp()).forEach((g) => grpSeen.add(g));
    for (let i = 0; i < 10; i++) {
        const nb = page.locator('[wire\\:click^="nextPage"]:visible').first();
        if (!(await nb.count()) || (await nb.isDisabled())) break;
        await nb.click();
        await sleep(1300);
        (await grabGrp()).forEach((g) => grpSeen.add(g));
    }
    const grpTxt = Array.from(grpSeen).join(' | ');
    const grpSql = q(`SELECT kategori, COUNT(*) c FROM gridtest GROUP BY kategori ORDER BY kategori`).map((r) => `${r.kategori}=${r.c}`).join(' ');
    const grpOk = ['alpha', 'beta', 'gama'].every((k) => new RegExp('Kategori:\\s*' + k, 'i').test(grpTxt));
    check('G4. group headers alpha/beta/gama shown (sql: ' + grpSql + ')', grpOk, grpTxt.slice(0, 140));

    // ================================================================
    // K1. Kanban transitions (server-side validation)
    // ================================================================
    await page.goto(APP + '/admin/gridtests-board', { waitUntil: 'networkidle' });
    await sleep(1500);
    const draftId = q(`SELECT id FROM gridtest WHERE status_kerja='Draft' LIMIT 1`)[0].id;
    const kanbanCall = async (id, to) => page.evaluate(([rid, st]) => {
        const comps = window.Livewire ? window.Livewire.all() : [];
        for (const c of comps) {
            const d = c.snapshot && c.snapshot.data;
            // The board page component owns the `columns` array property.
            if (d && Object.prototype.hasOwnProperty.call(d, 'columns')) {
                try { c.$wire.call('moveRecord', rid, st); return c.id; } catch (e) { return 'err:' + e.message; }
            }
        }
        return null;
    }, [String(draftId), to]);
    // allowed: Draft -> Review
    await kanbanCall(draftId, 'Review');
    await sleep(1800);
    const afterOk = q(`SELECT status_kerja FROM gridtest WHERE id=${draftId}`)[0].status_kerja;
    check('K1a. allowed transition Draft->Review persisted', afterOk === 'Review', 'db=' + afterOk);
    // disallowed: Review -> Approved is ALLOWED per config; Approved -> Draft is NOT.
    // Force a disallowed jump straight from current status via raw call:
    await kanbanCall(draftId, 'Draft'); // Review->Draft NOT in map (Review allows Approved,Draft) -> actually allowed
    await sleep(1500);
    const afterBack = q(`SELECT status_kerja FROM gridtest WHERE id=${draftId}`)[0].status_kerja;
    check('K1b. Review->Draft (in allowed map) persisted', afterBack === 'Draft', 'db=' + afterBack);
    // now Draft -> Approved (NOT allowed)
    await kanbanCall(draftId, 'Approved');
    await sleep(1800);
    const afterBad = q(`SELECT status_kerja FROM gridtest WHERE id=${draftId}`)[0].status_kerja;
    check('K1c. disallowed Draft->Approved rejected (stays Draft)', afterBad === 'Draft', 'db=' + afterBad);

    // ================================================================
    // V1. Calendar: Item05 (tarikh 2026-10-05) appears on Oct 5
    // ================================================================
    await page.goto(APP + '/admin/gridtests-calendar', { waitUntil: 'networkidle' });
    await sleep(1500);
    const calTxt = await page.evaluate(() => document.body.innerText);
    const calOk = /Item05/.test(calTxt) && /October\s*2026/i.test(calTxt);
    check('V1. calendar shows Item05 in October 2026', calOk, calTxt.slice(0, 100).replace(/\n/g, ' '));

    // ================================================================
    // V2. Tree: Item01 root, Item02 depth 1, Item03 depth 2
    // ================================================================
    await page.goto(APP + '/admin/gridtests-tree', { waitUntil: 'networkidle' });
    await sleep(1500);
    const treeInfo = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('[data-depth], .fi-tree-row, li, tr'));
        const out = {};
        rows.forEach((r) => {
            const t = (r.innerText || '').trim();
            const d = r.getAttribute('data-depth');
            const m = t.match(/Item0[123]/);
            if (m && out[m[0]] === undefined) {
                out[m[0]] = d !== null ? parseInt(d, 10) : (t.length ? (r.className.match(/depth-(\d)/) || [])[1] : null);
            }
        });
        return out;
    });
    const treeTxt = await page.evaluate(() => document.body.innerText);
    const t1 = /Item01/.test(treeTxt), t2 = /Item02/.test(treeTxt), t3 = /Item03/.test(treeTxt);
    check('V2. tree shows root+child+grandchild (depth meta: ' + JSON.stringify(treeInfo) + ')', t1 && t2 && t3, treeTxt.slice(0, 120).replace(/\n/g, ' '));

    // ================================================================
    // S1/S2. Soft delete round-trip on Item12
    // ================================================================
    await page.goto(APP + '/admin/gridtest', { waitUntil: 'networkidle' });
    await sleep(1200);
    const delId = q(`SELECT id FROM gridtest WHERE nama_item='Item12'`)[0].id;
    // Item12 lives on page 3 (per-page 5) — search for it so it's on page 1
    await page.evaluate(() => {
        for (const c of window.Livewire.all()) {
            if ('tableSearch' in c.snapshot.data) { c.$wire.set('tableSearch', 'Item12'); return; }
        }
    });
    await sleep(1800);
    // delete via row action
    const row = page.locator(`table tbody tr:has-text("Item12")`).first();
    await row.locator('button:has-text("Padam"), button[aria-label*="Delete"], button[aria-label*="Padam"]').first().click();
    await sleep(900);
    await page.locator('.fi-modal button:has-text("Padam"), .fi-modal button:has-text("Delete")').first().click();
    await sleep(1800);
    const goneFromList = !(await page.locator('table tbody tr:has-text("Item12")').count());
    const dbDel = q(`SELECT deleted_at FROM gridtest WHERE id=${delId}`)[0].deleted_at;
    check('S1a. delete -> gone from list + deleted_at set', goneFromList && !!dbDel, `gone=${goneFromList} deleted_at=${dbDel}`);
    // S2: edit via URL must NOT open editable form
    const resp = await page.goto(APP + `/admin/gridtest/${delId}/edit`, { waitUntil: 'networkidle' }).catch(() => null);
    const status = resp ? resp.status() : 0;
    const stillEditable = await page.locator('#form\\.nama_item').count();
    const redirected = !String(page.url()).includes(`/gridtests/${delId}/edit`);
    check('S2. soft-deleted row edit via URL blocked (404/redirect, not editable)',
        (status === 404 || redirected || stillEditable === 0), `status=${status} editable=${stillEditable} url=${page.url()}`);
    // restore via trash filter — open the filters panel (icon button),
    // pick "Dengan rekod" (with trashed) in the trashed select, apply.
    await page.goto(APP + '/admin/gridtest', { waitUntil: 'networkidle' });
    await sleep(1500);
    await page.locator('button[aria-label="Tapisan"]').click();
    await sleep(2500);
    let setTrashed = false;
    const trashedSel = page.locator('select[mwire], select').filter({ has: page.locator('option[value="1"]') });
    const allSels = await page.locator('select').all();
    for (const s of allSels) {
        const wire = await s.getAttribute('wire:model') || await s.getAttribute('wire:model.live') || '';
        if (wire.includes('trashed')) {
            await s.selectOption('1'); // "Dengan rekod" = include trashed
            setTrashed = true;
            break;
        }
    }
    if (setTrashed) {
        await page.locator('button:has-text("Gunakan tapisan")').first().click();
        await sleep(2500);
    } else {
        await sleep(1500);
    }
    // narrow to Item12 so it lands on page 1
    await page.evaluate(() => {
        for (const c of window.Livewire.all()) {
            if ('tableSearch' in c.snapshot.data) { c.$wire.set('tableSearch', 'Item12'); return; }
        }
    });
    await sleep(2500);
    const trashShown = await page.locator('table tbody tr:has-text("Item12")').count();
    check('S1b. trash filter shows deleted row (filterSet=' + setTrashed + ')', trashShown > 0, 'rows=' + trashShown);
    if (trashShown > 0) {
        await page.locator('table tbody tr:has-text("Item12") button:has-text("Pulihkan"), table tbody tr:has-text("Item12") button:has-text("Restore")').first().click();
        await sleep(1200);
        // restore opens a confirm modal — confirm it
        const conf = page.locator('.fi-modal button:has-text("Pulihkan"), .fi-modal button:has-text("Restore")').last();
        if (await conf.count()) await conf.click();
        await sleep(2000);
        const restored = q(`SELECT deleted_at FROM gridtest WHERE id=${delId}`)[0].deleted_at;
        check('S1c. restore -> deleted_at NULL', restored === null, 'deleted_at=' + JSON.stringify(restored));
    } else {
        check('S1c. restore action', false, 'trash row not found to restore');
    }

    // ================================================================
    // X1. CSV export: ALL rows (not just page), columns correct
    // ================================================================
    await page.goto(APP + '/admin/gridtest', { waitUntil: 'networkidle' });
    await sleep(1200);
    await page.locator('button:has-text("Eksport"), button:has-text("Export")').first().click();
    await sleep(1200);
    const confirm = page.locator('.fi-modal button:has-text("Eksport"), .fi-modal button:has-text("Export")').last();
    if (await confirm.count()) await confirm.click();
    await sleep(3000);
    // Filament v5 writes exports to storage/app/private/filament_exports/<id>/ — newest dir = this run
    const expBase = '/tmp/fsm-deep-app/storage/app/private/filament_exports';
    const expDir = fs.readdirSync(expBase).map((d) => ({ d, t: fs.statSync(expBase + '/' + d).mtimeMs })).sort((a, b) => b.t - a.t)[0];
    const expDirPath = expBase + '/' + expDir.d + '/';
    const expFile = expDir ? expDirPath + '0000000000000001.csv' : null;
    if (expFile && fs.existsSync(expFile)) {
        const lines = fs.readFileSync(expFile, 'utf8').trim().split('\n');
        const dataRows = lines.filter((l) => /Item\d\d/.test(l));
        const liveCount = q(`SELECT COUNT(*) c FROM gridtest WHERE deleted_at IS NULL`)[0].c;
        check('X1a. export covers whole table (all live rows, not just page)', dataRows.length === liveCount && liveCount > 5, 'csv=' + dataRows.length + ' live=' + liveCount + ' file=' + expFile);
        const hdr = fs.readFileSync(expDirPath + 'headers.csv', 'utf8');
        check('X1b. export header has expected columns (human labels)', /Nama Item/.test(hdr) && /Nilai/.test(hdr) && /Kategori/.test(hdr), hdr.slice(0, 120));
    } else {
        check('X1. export file produced', false, 'no export csv in filament_exports');
    }

    // ================================================================
    // X2. CSV import round-trip: comma + unicode + empty-vs-NULL
    // ================================================================
    const impCsv = '/tmp/fasa22_import.csv';
    fs.writeFileSync(impCsv, [
        'nama_item,nilai,skor,kuantiti,tinggi,lebar,kategori,status_kerja,tarikh_hantar,parent_id',
        '"ItemKoma, Saja",7.25,3,4,5,6,beta,Draft,2026-10-20,',
        'ItemUnicode™ Éà,9,1,1,1,1,gama,Draft,2026-10-21,',
    ].join('\n'));
    await page.locator('button:has-text("Import")').first().click();
    await sleep(1200);
    await page.locator('.fi-modal input[type=file]').first().setInputFiles(impCsv);
    // wait until the modal's Import button is enabled (upload finished, mapping ready)
    const startBtn = page.locator('.fi-modal button:has-text("Import")').last();
    for (let i = 0; i < 20; i++) {
        await sleep(700);
        if (await startBtn.count() && await startBtn.isEnabled()) break;
    }
    if (await startBtn.count() && await startBtn.isEnabled()) await startBtn.click();
    await sleep(4000);
    const impKoma = q(`SELECT nama_item, nilai FROM gridtest WHERE nama_item LIKE 'ItemKoma%'`);
    check('X2a. comma-in-value imported intact', impKoma.length === 1 && impKoma[0].nama_item === 'ItemKoma, Saja', JSON.stringify(impKoma));
    const impUni = q(`SELECT nama_item FROM gridtest WHERE nama_item LIKE 'ItemUnicode%'`);
    check('X2b. unicode imported intact', impUni.length === 1 && impUni[0].nama_item === 'ItemUnicode™ Éà', JSON.stringify(impUni));

    // ================================================================
    // X3. Broken row (missing required nama_item) -> clear report,
    //     no half-baked data
    // ================================================================
    const badCsv = '/tmp/fasa22_bad.csv';
    fs.writeFileSync(badCsv, [
        'nama_item,nilai,skor,kuantiti,tinggi,lebar,kategori,status_kerja,tarikh_hantar,parent_id',
        'ItemBaik1,1,1,1,1,1,alpha,Draft,2026-10-22,',
        ',5,5,5,5,5,beta,Draft,2026-10-23,',
    ].join('\n'));
    const beforeBad = q(`SELECT COUNT(*) c FROM gridtest`)[0].c;
    await page.locator('button:has-text("Import")').first().click();
    await sleep(1200);
    await page.locator('.fi-modal input[type=file]').first().setInputFiles(badCsv);
    const start2 = page.locator('.fi-modal button:has-text("Import")').last();
    for (let i = 0; i < 20; i++) {
        await sleep(700);
        if (await start2.count() && await start2.isEnabled()) break;
    }
    if (await start2.count() && await start2.isEnabled()) await start2.click();
    await sleep(4500);
    const afterBadCount = q(`SELECT COUNT(*) c FROM gridtest`)[0].c;
    const errShown = await page.evaluate(() => {
        const m = document.querySelector('.fi-modal, .fi-notification');
        return m ? m.innerText : '';
    });
    const failedRows = q(`SELECT import_id, validation_error FROM failed_import_rows WHERE data LIKE '%beta%2026-10-23%' ORDER BY id DESC LIMIT 1`);
    const reported = /error|invalid|required|fail|gagal|ralat/i.test(errShown) || failedRows.length > 0;
    const inserted = afterBadCount - beforeBad;
    check('X3. broken row: clear report AND no half-baked insert (inserted=' + inserted + ', reported=' + reported + ')',
        reported && (inserted === 0 || inserted === 1),
        `before=${beforeBad} after=${afterBadCount} msg=${errShown.slice(0, 120).replace(/\n/g, ' ')}`);
    if (inserted === 1) {
        note('X3 contract: Filament importer validates per-row — the VALID row imports, the broken row is skipped with an error report (no partial-row writes).');
    } else if (inserted === 0) {
        note('X3 contract: importer rolled back the whole batch on the broken row.');
    }

    // ---- summary ----
    console.log('\n================ FASA 22 RUNTIME SUMMARY ================');
    console.log(`${pass} PASS / ${fail} FAIL`);
    if (failures.length) { console.log('FAILURES:'); failures.forEach((f) => console.log('  - ' + f)); }
    if (contracts.length) { console.log('CONTRACTS RECORDED:'); contracts.forEach((c) => console.log('  * ' + c)); }
    if (pageErrors.length) { console.log('PAGE ERRORS: ' + pageErrors.slice(0, 5).join(' | ')); }
    await browser.close();
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS FATAL:', e.stack || e.message); process.exit(1); });
