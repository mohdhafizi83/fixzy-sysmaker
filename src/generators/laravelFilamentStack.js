// Orchestrator: full generation sequence for the Laravel + Filament stack.
// Extracted verbatim from src/main.js (2026-09-21) so generators can run headless
// (golden tests, CLI) without Electron. main.js now requires this module.

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');

const {
    generateFilamentResources,
    generateFilamentResourcesCustomModules
} = require('./laravelResourceGenerator');
const {
    generateFilamentListPages,
    generateFilamentListCustomModules
} = require('./laravelListGenerator');
const {
    generateFilamentCreatePages,
    generateFilamentCreateCustomModules
} = require('./laravelCreateGenerator');
const {
    generateFilamentEditPages,
    generateFilamentEditCustomModules
} = require('./laravelEditGenerator');
const { generateFilamentRelationManagers } = require('./laravelRelationManagersGenerator');
const {
    generateFilamentTablesTable,
    generateFilamentTablesCustomModules
} = require('./laravelTablesGenerator');
const {
    generateFilamentSchemasForm,
    generateFilamentSchemasCustomModules
} = require('./laravelSchemasGenerator');
const {
    generateFilamentModels,
    generateFilamentUserModel,
    generateLaravelUserMigration,
    generateLaravelMigrations,
    generateLaravelFactories,
    generateLaravelDatabaseSeeder,
    generateNativeAuditFiles
} = require('./laravelDatabaseGenerator');
const { generateFilamentExports } = require('./laravelExportsGenerator');
const { generateFilamentImporters } = require('./laravelImportersGenerator');
const { generateAdminPanelProvider } = require('./laravelAdminPanelGenerator');
const { generateWorkflowHooks } = require('./laravelWorkflowGenerator');
const { generateAuthIntegrations } = require('./laravelAuthIntegrationsGenerator');
const { generateRealtimeModule } = require('./laravelRealtimeGenerator');
const { generateActivityLogModule } = require('./laravelActivityLogGenerator');
const { generateGoogleSheetsModule } = require('./laravelGoogleSheetsGenerator');
const { generateDeploymentGuidePage } = require('./laravelDocsGenerator');

/**
 * ORCHESTRATOR: Manages the full generation sequence for the Laravel Filament stack.
 */
async function generateLaravelFilamentStack(fullSchema, outputDir) {
    try {
        console.log("Memulakan Orchestrator Laravel Filament...");
        
        // Pastikan folder output wujud
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // ============================================================
        // FASA 1: DATABASE LAYER
        // ============================================================
        console.log("--- Menjana Database Layer ---");

        const migrationUserResult = await generateLaravelUserMigration(fullSchema, outputDir);
        if (!migrationUserResult.success) throw new Error(`Migrations Users: ${migrationUserResult.message}`);
        
        const migrationResult = await generateLaravelMigrations(fullSchema, outputDir);
        if (!migrationResult.success) throw new Error(`Migrations: ${migrationResult.message}`);

        const modelResult = await generateFilamentModels(fullSchema, outputDir);
        if (!modelResult.success) throw new Error(`Models: ${modelResult.message}`);

        const userModelResult = await generateFilamentUserModel(fullSchema, outputDir);
        if (!userModelResult.success) throw new Error(`User Model: ${userModelResult.message}`);

        const factoryResult = await generateLaravelFactories(fullSchema, outputDir);
        if (!factoryResult.success) throw new Error(`Factories: ${factoryResult.message}`);

        const seederResult = await generateLaravelDatabaseSeeder(fullSchema, outputDir);
        if (!seederResult.success) throw new Error(`Seeders: ${seederResult.message}`);

        // Native audit-trail files (Phase 4: replaces owen-it + tapp packages)
        const nativeAuditResult = await generateNativeAuditFiles(fullSchema, outputDir);
        if (!nativeAuditResult.success) throw new Error(`Native audit: ${nativeAuditResult.message}`);

        // User Activity Log (sign-in/out/failed) + admin Activity Log page.
        const activityLogResult = generateActivityLogModule(fullSchema, outputDir);
        if (!activityLogResult.success) throw new Error(`Activity log: ${activityLogResult.message}`);

        // Approvals module (per-table state machine) — shared files.
        const { generateApprovalModule } = require('./laravelApprovalGenerator');
        const approvalResult = generateApprovalModule(fullSchema, outputDir);
        if (!approvalResult.success) throw new Error(`Approvals: ${approvalResult.message}`);

        // Scheduler module (reminders / recurring / backup) — shared files.
        const { generateSchedulerModule } = require('./laravelSchedulerGenerator');
        const schedulerResult = generateSchedulerModule(fullSchema, outputDir);
        if (!schedulerResult.success) throw new Error(`Scheduler: ${schedulerResult.message}`);
        if (schedulerResult.schedules) {
            console.log(`[scheduler] ${schedulerResult.schedules} schedule entr(ies) compiled`);
        }

        // System tools module (server status page, PWA shell) — shared files.
        const { generateSystemToolsModule } = require('./laravelSystemToolsGenerator');
        const sysToolsResult = generateSystemToolsModule(fullSchema, outputDir);
        if (!sysToolsResult.success) throw new Error(`System tools: ${sysToolsResult.message}`);

        // Attachments module (multi-file documents per record) — shared files.
        const { generateAttachmentModule } = require('./laravelAttachmentGenerator');
        const attachmentResult = generateAttachmentModule(fullSchema, outputDir);
        if (!attachmentResult.success) throw new Error(`Attachments: ${attachmentResult.error || attachmentResult.message}`);

        // Public intake form module (guest submissions + status lookup).
        const { generatePublicFormModule } = require('./laravelPublicFormGenerator');
        const publicFormResult = generatePublicFormModule(fullSchema, outputDir);
        if (!publicFormResult.success) throw new Error(`PublicForm: ${publicFormResult.error || publicFormResult.message}`);

        // Conversational form module (chat-style intake, E6).
        const { generateConversationalFormModule } = require('./laravelConversationalFormGenerator');
        const conversationalResult = generateConversationalFormModule(fullSchema, outputDir);
        if (!conversationalResult.success) throw new Error(`ConversationalForm: ${conversationalResult.error || conversationalResult.message}`);

        // Auto Numbering module (race-safe reference codes).
        const { generateNumberingModule } = require('./laravelNumberingGenerator');
        const numberingResult = generateNumberingModule(fullSchema, outputDir);
        if (!numberingResult.success) throw new Error(`Numbering: ${numberingResult.error || numberingResult.message}`);

        // Reports & Charts module (Dashboard Builder widgets).
        const { generateReportModule } = require('./laravelReportGenerator');
        const reportResult = generateReportModule(fullSchema, outputDir);
        if (!reportResult.success) throw new Error(`Reports: ${reportResult.error || reportResult.message}`);

        // Homepage grid + custom menu links (Menu Management tab).
        const { generateHomepageModule } = require('./laravelHomepageGenerator');
        const homepageResult = await generateHomepageModule(fullSchema, outputDir);
        if (!homepageResult.success) throw new Error(`Homepage: ${homepageResult.error || homepageResult.message}`);

        // Localization module (Malay + English switcher).
        const { generateLocalizationModule } = require('./laravelLocalizationGenerator');
        const localizationResult = generateLocalizationModule(fullSchema, outputDir);
        if (!localizationResult.success) throw new Error(`Localization: ${localizationResult.error || localizationResult.message}`);

        // REST API module (Sanctum token auth, per-table allowlists).
        const { generateApiModule } = require('./laravelApiGenerator');
        const apiResult = generateApiModule(fullSchema, outputDir);
        if (!apiResult.success) throw new Error(`REST API: ${apiResult.error || apiResult.message}`);

        // Native PrintAction class — referenced by resources with print view
        // enabled; must ship with the generated app, not just the preview skeleton.
        const anyPrint = Object.values(fullSchema.database.table || {})
            .some(t => t.allow_print_view === 1 || t.dv_allow_print_view === 1);
        if (anyPrint) {
            const printDir = path.join(outputDir, 'app', 'Filament', 'Actions');
            fs.mkdirSync(printDir, { recursive: true });
            fs.writeFileSync(path.join(printDir, 'PrintAction.php'), renderTemplate('app/Filament/Actions/PrintAction.php.njk', {}));
        }

        // Native login page (BUG-015): captcha human check and/or LDAP
        // directory auth, combined into one FixzyLogin class.
        // auth_captcha_mode selects basic (arithmetic) vs Google reCAPTCHA v2;
        // in recaptcha mode the arithmetic check is replaced, not doubled.
        const authConfig = require('./authConfig');
        const captchaOn = Number((fullSchema.project || {}).module_auth_email_captcha) === 1;
        const recaptcha = authConfig.isRecaptcha(fullSchema.project);
        const captcha = captchaOn && !recaptcha;
        const ldap = Number((fullSchema.project || {}).module_auth_ldap) === 1;
        if (captcha || recaptcha || ldap) {
            const authDir = path.join(outputDir, 'app', 'Filament', 'Auth');
            fs.mkdirSync(authDir, { recursive: true });
            fs.writeFileSync(
                path.join(authDir, 'FixzyLogin.php'),
                renderTemplate('app/Filament/Auth/FixzyLogin.php.njk', { captcha, recaptcha, ldap })
            );
        }
        if (recaptcha) {
            const viewsDir = path.join(outputDir, 'resources', 'views', 'filament');
            fs.mkdirSync(viewsDir, { recursive: true });
            fs.writeFileSync(
                path.join(viewsDir, 'fixzy-recaptcha-widget.blade.php'),
                renderTemplate('resources/views/filament/fixzy-recaptcha-widget.blade.php.njk', {})
            );
        }

        // SSO / LDAP integration files + deploy manifest (plug-and-play).
        // Provider registration into bootstrap/providers.php is handled
        // inside the generator itself (idempotent).
        const authIntegrations = await generateAuthIntegrations(fullSchema, outputDir);
        if (!authIntegrations.success) throw new Error(`Auth integrations: ${authIntegrations.message}`);

        // Native BelongsToTenant trait — used by 1:m tenancy models.
        if (fullSchema.project && fullSchema.project.tenancy_type === 'one_to_many') {
            const concernsDir = path.join(outputDir, 'app', 'Models', 'Concerns');
            fs.mkdirSync(concernsDir, { recursive: true });
            fs.writeFileSync(path.join(concernsDir, 'BelongsToTenant.php'), renderTemplate('app/Models/Concerns/BelongsToTenant.php.njk', {}));
        }


        // ============================================================
        // FASA 2: STANDARD Module (CRUD ASAL)
        // ============================================================
        console.log("--- Menjana Standard Resources ---");

        // 1. Components (Table & Form) MUST be generated first because the Resource references them
        const tableResult = await generateFilamentTablesTable(fullSchema, outputDir);
        if (!tableResult.success) throw new Error(`Tables (Standard): ${tableResult.message}`);

        // Grid enhancements (sticky header / row density CSS + provider).
        // Only emits files when at least one table uses a non-default style.
        const gridResult = require('./laravelGridEnhancementsGenerator').generateGridEnhancements(fullSchema, outputDir);
        if (!gridResult.success) throw new Error(`Grid enhancements: ${gridResult.message}`);

        const formResult = await generateFilamentSchemasForm(fullSchema, outputDir);
        if (!formResult.success) throw new Error(`Forms (Standard): ${formResult.message}`);

        // 2. Pages
        await generateFilamentListPages(fullSchema, outputDir);
        await generateFilamentCreatePages(fullSchema, outputDir);
        await generateFilamentEditPages(fullSchema, outputDir);

        // 2b. Calendar pages (Phase D2: read-only month view per opted-in table)
        await require('./laravelCalendarGenerator').generateCalendarPages(fullSchema, outputDir);

        // 2c. Tree pages (Phase D3: read-only hierarchy view per opted-in table)
        await require('./laravelTreeGenerator').generateTreePages(fullSchema, outputDir);

        // 2d. Kanban board pages (Phase D4: drag-drop status board per opted-in table)
        await require('./laravelKanbanGenerator').generateKanbanPages(fullSchema, outputDir);

        // 3. Relation Managers
        await generateFilamentRelationManagers(fullSchema, outputDir);

        // 4. Parent Resources (ties everything above together)
        const resourceResult = await generateFilamentResources(fullSchema, outputDir);
        if (!resourceResult.success) throw new Error(`Resources (Standard): ${resourceResult.message}`);


        // ============================================================
        // FASA 3: CUSTOM VIEWS (FASA BARU)
        // ============================================================
        console.log("--- Menjana Custom Modules ---");

        // 1. Components Custom Module
        const cvTableResult = await generateFilamentTablesCustomModules(fullSchema, outputDir);
        if (!cvTableResult.success) console.warn(`Custom Tables Warning: ${cvTableResult.message}`);

        const cvFormResult = await generateFilamentSchemasCustomModules(fullSchema, outputDir);
        if (!cvFormResult.success) console.warn(`Custom Forms Warning: ${cvFormResult.message}`);

        // 2. Pages Custom Module
        await generateFilamentListCustomModules(fullSchema, outputDir);
        await generateFilamentCreateCustomModules(fullSchema, outputDir);
        await generateFilamentEditCustomModules(fullSchema, outputDir);

        // 3. Custom Module Resources (no special Relation Manager, use standard)
        const cvResourceResult = await generateFilamentResourcesCustomModules(fullSchema, outputDir);
        if (!cvResourceResult.success) console.warn(`Custom Resources Warning: ${cvResourceResult.message}`);


        // ============================================================
        // FASA 4: CIRI TAMBAHAN & KONFIGURASI
        // ============================================================
        console.log("--- Generating Additional Features ---");

        const exportResult = await generateFilamentExports(fullSchema, outputDir);
        if (!exportResult.success) throw new Error(`Exports: ${exportResult.message}`);
        
        const importResult = await generateFilamentImporters(fullSchema, outputDir);
        if (!importResult.success) throw new Error(`Imports: ${importResult.message}`);
        
        const adminPanelResult = await generateAdminPanelProvider(fullSchema, outputDir);
        if (!adminPanelResult.success) throw new Error(`AdminPanelProvider: ${adminPanelResult.message}`);
        
        const workflowResult = await generateWorkflowHooks(fullSchema, outputDir);
        if (!workflowResult.success) throw new Error(`Workflow hooks: ${workflowResult.message}`);
        console.log(`[workflow] ${workflowResult.message}`);

        // Real-time notifications & chat (native Filament notifications +
        // Laravel broadcasting; Reverb/Pusher only as transport).
        const realtimeResult = await generateRealtimeModule(fullSchema, outputDir);
        if (!realtimeResult.success) throw new Error(`Real-time module: ${realtimeResult.message}`);
        if (realtimeResult.backend) {
            console.log(`[realtime] enabled via ${realtimeResult.backend} (${realtimeResult.composerPackages.join(', ')})`);
        }

        // Google Sheets two-way sync (custom tables opted in; add/update
        // only; service-account auth; polling every few minutes).
        const gsheetsResult = await generateGoogleSheetsModule(fullSchema, outputDir);
        if (!gsheetsResult.success) throw new Error(`Google Sheets sync: ${gsheetsResult.message}`);
        if (gsheetsResult.syncedTables && gsheetsResult.syncedTables.length) {
            console.log(`[gsheets] sync enabled for: ${gsheetsResult.syncedTables.join(', ')}`);
        }

        const guideResult = await generateDeploymentGuidePage(fullSchema, outputDir);
        if (!guideResult.success) console.warn(`Guide Warning: ${guideResult.message}`); // Warning sahaja, bukan error

        console.log("Finished generating the Laravel Filament stack.");
        return { success: true, message: "The application was fully generated." };

    } catch (error) {
        console.error("Ralat Kritikal Orchestrator:", error);
        return { success: false, message: error.message };
    }
}

module.exports = { generateLaravelFilamentStack };
