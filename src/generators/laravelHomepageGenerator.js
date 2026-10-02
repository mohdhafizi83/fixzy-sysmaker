// Homepage grid + custom menu links generator (Fixzy SysMaker).
//
// Implements the Menu Management tab options that previously had no
// consumer in the generated app:
//   * menu_at_homepage  -> the panel landing page is a card grid of
//     the project's table modules (AppGini-style homepage).
//   * tables_per_row    -> grid columns (1..5).
//   * panel_height      -> card height in pixels.
//   * extra_wide        -> first card spans two grid columns.
//   * custom menu items -> each custom_item (label + URL) becomes a
//     navigation link page in the generated panel.
//
// Emits:
//   app/Filament/Pages/FixzyHomepage.php
//   resources/views/filament/pages/homepage.blade.php
//   app/Filament/Pages/MenuLink<id>.php        (one per custom item)
'use strict';

const fs = require('fs');
const path = require('path');
const { toFlatCase, toPluralPascalCase } = require('../utils');

function escapePhpString(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Resolve the resource URL slug for a table item the same way
 * laravelResourceGenerator does: module_name (if set) else table name,
 * flat-cased.
 */
function slugForTable(tableName, tables) {
    const t = tables[tableName] || {};
    const nameSource = (t.module_name && String(t.module_name).trim() !== '') ? t.module_name : tableName;
    return toFlatCase(nameSource);
}

/**
 * Collect homepage cards from the unified menu: every table_item (top
 * level or inside groups) in menu order.
 */
function collectHomepageCards(fullSchema) {
    const tables = (fullSchema.database && fullSchema.database.table) || {};
    const menu = (fullSchema.database && fullSchema.database.unified_menu) || [];
    const cards = [];
    const seen = new Set();

    const pushItem = (item, groupOrder) => {
        if (!item.table_name || seen.has(item.table_name)) return;
        const t = tables[item.table_name];
        if (!t) return;
        seen.add(item.table_name);
        const nameSource = (t.module_name && String(t.module_name).trim() !== '') ? t.module_name : item.table_name;
        cards.push({
            label: item.item_label || toPluralPascalCase(nameSource),
            slug: slugForTable(item.table_name, tables),
            groupOrder: groupOrder == null ? 0 : groupOrder,
            order: Number(item.item_order || 0),
        });
    };

    menu.forEach((entry) => {
        if (entry.type === 'group') {
            (entry.items || []).forEach((it) => pushItem(it, Number(entry.order || 0)));
        } else if (entry.type === 'table_item') {
            pushItem(entry, 0);
        }
    });

    cards.sort((a, b) => (a.groupOrder - b.groupOrder) || (a.order - b.order));
    return cards;
}

/**
 * Collect custom menu items (free label + URL, not table-backed).
 */
function collectCustomLinks(fullSchema) {
    const menu = (fullSchema.database && fullSchema.database.unified_menu) || [];
    const links = [];
    const seen = new Set();

    const push = (item, groupName, groupOrder) => {
        if (item.type !== 'custom_item') return;
        const key = `${item.item_label}|${item.item_detail}`;
        if (seen.has(key)) return;
        seen.add(key);
        links.push({
            item_id: item.item_id,
            label: item.item_label || 'Link',
            url: item.item_detail || '#',
            group: groupName || null,
            groupOrder: groupOrder == null ? 0 : groupOrder,
            order: Number(item.item_order || 0),
        });
    };

    menu.forEach((entry) => {
        if (entry.type === 'group') {
            (entry.items || []).forEach((it) => push(it, entry.name, Number(entry.order || 0)));
        } else {
            push(entry, null, 0);
        }
    });

    links.sort((a, b) => (a.groupOrder - b.groupOrder) || (a.order - b.order));
    return links;
}

function homepagePagePhp(panelHeight, perRow, extraWide) {
    return `<?php

namespace App\\Filament\\Pages;

use Filament\\Pages\\Page;

/**
 * Homepage card grid (Fixzy SysMaker generated code).
 *
 * Driven by Menu Management: tables per row (${perRow}), panel height
 * (${panelHeight}px), first card extra wide (${extraWide ? 'yes' : 'no'}).
 * The panel's home URL points here when "Menu at Homepage" is enabled.
 */
class FixzyHomepage extends Page
{
    protected static ?string $slug = 'home';

    protected static string | \\BackedEnum | null $navigationIcon = 'heroicon-o-home';

    protected static ?string $navigationLabel = 'Home';

    protected static ?string $title = 'Home';

    // The homepage is the landing page, not a menu entry.
    protected static bool $shouldRegisterNavigation = false;

    protected string $view = 'filament.pages.homepage';
}
`;
}

function homepageBlade(cards, perRow, panelHeight, extraWide) {
    const widthPct = (100 / perRow).toFixed(4);
    const widePct = Math.min(100, perRow >= 2 ? (200 / perRow) : 100).toFixed(4);
    const rows = cards.map((c, i) => {
        const wide = extraWide && i === 0 && perRow >= 2;
        const w = wide ? widePct : widthPct;
        return `        <a href="/admin/${escapeHtml(c.slug)}" style="box-sizing:border-box; width:calc(${w}% - 16px); height:${panelHeight}px; margin:8px; border:1px solid #e5e7eb; border-radius:12px; padding:16px; text-decoration:none; color:inherit; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.05); display:flex; align-items:center; justify-content:center; font-weight:600; font-size:${wide ? '1.15rem' : '1rem'}; text-align:center;" class="dark:border-gray-700 dark:bg-gray-800">${escapeHtml(c.label)}</a>`;
    }).join('\n');
    return `<x-filament-panels::page>
<div style="display:flex; flex-wrap:wrap; margin:-8px;">
${rows || '    <p style="padding:8px; color:#6b7280;">No modules yet.</p>'}
</div>
</x-filament-panels::page>
`;
}

function menuLinkPagePhp(link) {
    const cls = `MenuLink${Number(link.item_id) || 0}`;
    const groupProp = link.group
        ? `\n    protected static string | \\BackedEnum | null $navigationGroup = '${escapePhpString(link.group)}';`
        : '';
    return `<?php

namespace App\\Filament\\Pages;

use Filament\\Pages\\Page;

/**
 * Custom menu link (Fixzy SysMaker generated code).
 *
 * Menu Management custom item "${escapePhpString(link.label)}" -> ${escapePhpString(link.url)}
 * Navigation links straight to the configured URL.
 */
class ${cls} extends Page
{
    protected static string | \\BackedEnum | null $navigationIcon = 'heroicon-o-link';

    protected static ?string $navigationLabel = '${escapePhpString(link.label)}';

    protected static ?int $navigationSort = ${Number(link.order) || 0};${groupProp}

    // The menu entry links straight out to the configured URL.
    protected static bool $shouldRegisterNavigation = true;

    protected string $view = 'filament.pages.menu-link';

    public static function getNavigationUrl(): string
    {
        return '${escapePhpString(link.url)}';
    }

    public static function getNavigationBadge(): ?string
    {
        return null;
    }
}
`;
}

const MENU_LINK_BLADE = `<x-filament-panels::page>
    <div style="padding:2rem; text-align:center;">
        <p>This menu entry links to an external page.</p>
    </div>
</x-filament-panels::page>
`;

/**
 * Generate the homepage module. Always emits the homepage page + view
 * when there is at least one table card; custom link pages are emitted
 * per custom_item. menu_at_homepage=0 skips the homepage (custom links
 * are still generated — they belong to the menu, not the homepage).
 *
 * @param {object} fullSchema assembled project schema
 * @param {string} outputDir generated app root
 * @returns {{success: boolean, files: string[], homepage: boolean}}
 */
async function generateHomepageModule(fullSchema, outputDir) {
    try {
        const project = fullSchema.project || {};
        const tables = (fullSchema.database && fullSchema.database.table) || {};
        const written = [];

        // --- Homepage grid ---
        const homepageOn = Number(project.menu_at_homepage ?? 1) === 1;
        const cards = homepageOn ? collectHomepageCards(fullSchema) : [];
        if (cards.length > 0) {
            let perRow = parseInt(project.tables_per_row, 10) || 4;
            perRow = Math.max(1, Math.min(5, perRow));
            let panelHeight = parseInt(project.panel_height, 10) || 100;
            panelHeight = Math.max(40, Math.min(600, panelHeight));
            const extraWide = Number(project.extra_wide ?? 0) === 1;

            const pagesDir = path.join(outputDir, 'app', 'Filament', 'Pages');
            fs.mkdirSync(pagesDir, { recursive: true });
            const pagePath = path.join(pagesDir, 'FixzyHomepage.php');
            fs.writeFileSync(pagePath, homepagePagePhp(panelHeight, perRow, extraWide));
            written.push(pagePath);

            const viewsDir = path.join(outputDir, 'resources', 'views', 'filament', 'pages');
            fs.mkdirSync(viewsDir, { recursive: true });
            const viewPath = path.join(viewsDir, 'homepage.blade.php');
            fs.writeFileSync(viewPath, homepageBlade(cards, perRow, panelHeight, extraWide));
            written.push(viewPath);
        }

        // --- Custom menu link pages ---
        const links = collectCustomLinks(fullSchema);
        const pagesDir = path.join(outputDir, 'app', 'Filament', 'Pages');
        if (links.length > 0) fs.mkdirSync(pagesDir, { recursive: true });
        const viewOnce = new Set();
        for (const link of links) {
            if (!link.item_id) continue;
            const cls = `MenuLink${Number(link.item_id) || 0}`;
            const pagePath = path.join(pagesDir, `${cls}.php`);
            fs.writeFileSync(pagePath, menuLinkPagePhp(link));
            written.push(pagePath);
            if (!viewOnce.has(cls)) {
                const viewsDir = path.join(outputDir, 'resources', 'views', 'filament', 'pages');
                fs.mkdirSync(viewsDir, { recursive: true });
                const viewPath = path.join(viewsDir, 'menu-link.blade.php');
                if (!fs.existsSync(viewPath)) {
                    fs.writeFileSync(viewPath, MENU_LINK_BLADE);
                    written.push(viewPath);
                }
                viewOnce.add(cls);
            }
        }

        return { success: true, files: written, homepage: cards.length > 0, customLinks: links.length };
    } catch (err) {
        return { success: false, message: err.message };
    }
}

/** True when the generated app should point the panel home at FixzyHomepage. */
function homepageEnabled(fullSchema) {
    const project = (fullSchema && fullSchema.project) || {};
    if (Number(project.menu_at_homepage ?? 1) !== 1) return false;
    return collectHomepageCards(fullSchema).length > 0;
}

module.exports = { generateHomepageModule, homepageEnabled, collectHomepageCards, collectCustomLinks };
