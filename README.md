# Fixzy SysMaker

**Visual database designer that builds your admin back office.**

Describe your database — visually, or by importing an existing SQL dump — and get
a complete, production-ready admin system: migrations, models, resources, forms,
tables, CSV importers/exporters, audit trail, multi-tenancy, factories, and
deployment docs. Generated code is plain, readable app code — no proprietary
runtime, no lock-in.

Fixzy SysMaker is a **multi-stack generator**. Your design lives in a
stack-neutral intermediate representation (IR), and pluggable generators turn it
into real application code. **Laravel + Filament** is the first production-ready
target — the benchmark every future stack is measured against — with more stacks
on the roadmap.

Fixzy SysMaker is built for **semi-technical and non-technical users**: design
your data and admin screens through a guided interface, then hand clean,
production-quality code to your team (or deploy it yourself).

Runs three ways from one engine: **desktop app (Electron)**, **local web UI**,
and **headless CLI** for CI pipelines.

## Screenshots

Main configuration — pick stack, database, theme, deletion strategy, core modules:

![Main configuration](docs/screenshots/main-config.png)

Menu management — group and order the generated app's navigation:

![Menu management](docs/screenshots/menu-management.png)

Dashboard builder — stats and chart widgets bound to any table:

![Dashboard builder](docs/screenshots/dashboard-builder.png)

The result — a generated Laravel + Filament admin, live after one click:

![Generated app](docs/screenshots/generated-app.png)

---

## Installation

### Option 1 — Desktop app (recommended, easiest)

1. Download the installer for your OS from the
   [Releases](../../releases) page:
   - **Windows**: `Fixzy SysMaker Setup x.x.x.exe` (NSIS installer)
   - **macOS**: `Fixzy SysMaker x.x.x.dmg` (x64 and Apple Silicon)
2. Install and launch the app.
3. On first launch, the **Setup Wizard** checks your computer and installs
   everything it needs (PHP runtime, Composer, preview environment) with one
   click — no command line required.
4. Click **New Project** and start designing.

> You can reopen the Setup Wizard any time from the **Setup** button in the
> header to re-check or repair your environment.

### Option 2 — From source

Requirements: **Node.js 20+**. PHP 8.2+ is only needed for live preview/deploy
(the code generators themselves need no PHP).

```bash
git clone https://github.com/mohdhafizi83/fixzy-sysmaker.git
cd fixzy-sysmaker
npm install
npm run setup:binaries   # provisions PHP + composer.phar for your OS
npm start                # launches the desktop app
```

The Setup Wizard will also guide you through any missing pieces on first launch.

### Option 3 — CLI (for power users and CI)

```bash
# Local web UI (same app, in your browser)
node bin/fixzy.js serve                 # http://127.0.0.1:7788

# Generate an app from a saved project
node bin/fixzy.js generate --project "TaskFlow" --out ~/projects --zip

# Generate from a test fixture (no GUI needed — great for CI)
node bin/fixzy.js generate --fixture base_simple --out ~/projects --zip

# Inspect the store
node bin/fixzy.js list
node bin/fixzy.js fixtures
```

CLI environment variables:

| Variable | Purpose |
|---|---|
| `FSM_DATA_DIR` | Store directory (default `~/.fixzy`) |
| `FSM_PHP_BIN` | Explicit PHP binary path (skips provisioning) |
| `FSM_OUTPUT_ROOTS` | Allowed output roots (default `~/projects:$HOME`) |
| `FSM_ALLOW_REMOTE=1` | Required to bind the web UI to non-localhost |
| `FSM_DEVTOOLS=1` | Open Electron DevTools (development only) |

## Features

### Visual schema design
- **Table & field designer** — data types, lengths, defaults, validation rules,
  indexes, constraints, display types (media, repeater, lookup, and more)
- **Relationships** — one-to-many, one-to-one, many-to-many, polymorphic
- **Import existing databases** — upload or paste MySQL/MariaDB, PostgreSQL,
  SQL Server, or SQLite dumps and keep designing
- **Menu management** — group, order, and label the generated app's navigation
- **Dashboard builder** — stat cards and charts bound to any table

### What you get per generated app

| Layer | Output |
|---|---|
| Database | Migrations (FKs, indexes, soft deletes), seeders, factories |
| Models | Eloquent models with relations, `BelongsToTenant` / `HasAudits` traits |
| Admin UI | Filament 5 resources: forms, tables, pages, relation managers |
| Data I/O | CSV importers/exporters per table, native print action |
| Security | Native audit trail (migration + observer), tenancy scoping, Shield-ready |
| Auth | Optional Google SSO, LDAP / Active Directory, 2FA (email code or Google Authenticator TOTP), login captcha (built-in or Google reCAPTCHA v2) |
| Automation | **Enterprise:** visual workflow engine — hooks, actions, logic, scheduled jobs |
| Docs | In-app deployment guide (feature-aware) |

### Built-in features (selectable per project)

In Fixzy SysMaker, **built-in** means a feature you can tick on (or off) for
each generated app from the **Technologies Stack & Core Features** tab. Every
selection is saved with the project, carried through the IR, and compiled into
real code — the generated app ships only what you picked.

| Built-in feature | Default | What the generated app gets |
|---|---|---|
| Email & Password auth | Always on | Login page, password hashing, session handling |
| Two-Factor Authentication (2FA) | Off (radio) | Native Filament multi-factor auth on login |
| Login Captcha | Off (radio) | Native arithmetic human-check — no external service |
| LDAP / Active Directory | Off | Directory bind, auto account provisioning (ldaprecord-laravel) |
| Google SSO | Off | "Sign in with Google" via Socialite, first-login provisioning |
| Group-Based Permissions | Off | Roles & permissions per user group (Filament Shield) |
| Data Audit Trail | Off | Who changed what data: before/after values, IP, per-record trail (migration + observer) |
| User Activity Log | Off | What users did: sign-in / sign-out / failed sign-in, admin activity page (see below) |
| Approval Workflow | Off | Per-table status machine: statuses, transitions, role-gated actions, lock-on-final (see below) |
| Automation (Scheduler) | Off | Date reminders, recurring records (daily/weekly/monthly), scheduled backups with restore (see below) |
| File & Document Attachments | Off | Multi-file attachments per record, private storage + signed downloads, upload metadata (see below) |
| Public Intake Forms | Off | Guest-facing submit forms + status lookup, rate-limited + captcha + honeypot (see below) |
| Auto Numbering | Off | Race-safe reference codes per table (INV-202609-0001), prefix + date + width (see below) |
| Smart Import / Export | Off | CSV/XLSX import with match-field profiles (update/skip/insert), dry-run validation (see below) |
| Localization (Malay) | English | Full BM admin: chrome + validation via Filament's bundled Malay, per-field captions, live EN/BM switcher (see below) |
| REST API | Off | Token-authenticated JSON API per table (Sanctum), role-scoped read/write, field allowlists, rate limiting (see below) |
| Real-time Notifications & Chat | Off | Live notification bell + chat module over WebSocket (see below) |
| Google Sheets Sync | Off | Two-way sync of custom tables with Google Sheets (see below) |
| Fake Data (Data Seeder) | Off | Factories + seeders with realistic sample data |
| Debug Mode & Debugbar | Off | Detailed errors + debug bar (never enable in production) |
| Soft / Hard Delete | Hard | Per-project deletion strategy (soft = restorable rows) |
| Multi-tenancy | Per project | Row-level ownership & tenant scoping (`BelongsToTenant`) |

Plus the always-on baseline every generated app receives: migrations, Eloquent
models with relations, Filament 5 resources (forms/tables/pages), CSV
import/export per table, and a feature-aware deployment guide.

### Logging: Data Audit Trail & User Activity (opt-in)

Two independent, complementary logs — enable either one or both from the
**Logging** fieldset in the Technologies Stack tab.

**Data Audit Trail** — *who changed what data*
- Native `audits` table: polymorphic (any model), event, before/after
  values, user, URL, IP address, user agent — no third-party package
- `AuditObserver` + `HasAudits` trait record create/update/delete on every
  audited model; passwords and tokens are always stripped
- Read-only **Audits** relation manager on each resource: open any record
  and see its full change history inline

**User Activity Log** — *what users did in the app*
- Captures Laravel auth events passively: **signed in**, **signed out**,
  **failed sign-in** (with the attempted account name — never the
  password)
- Admin-only **Activity Log** page: filter by user, event type, and date
  range; deep-linkable (`/admin/activity-log?user=1&tab=data`)
- When the Data Audit Trail is also enabled, a second tab shows every
  data change (create/edit/delete) that the selected user made across all
  tables — a per-person activity feed
- Access control: super admin always; with Shield enabled, gate the page
  with a `view_any_activity_log` permission (create it in the Shield
  Roles UI)
- Logging failures never break login — the listener is a passive observer
  with its own error handling

### Approval Workflow (opt-in, per table)

Turn any table into a review pipeline. Enable the **Approvals** tab on a
table record and design the workflow visually — no code needed.

- **Statuses** with colour badges (gray/info/warning/success/danger);
  mark one as the first status (new records start there automatically)
  and any as **final** (locked — records stop moving)
- **Transitions** between statuses, each with its own button label,
  optional role restriction (Shield role names, comma-separated; empty =
  any signed-in user), optional mandatory comment, and optional notify
  target (`submitter` or any Shield role)
- **Presets** to start fast: simple (pending/approved/rejected),
  review (draft → in review → approved/rejected), two-step approval
- In the generated app: only legal transition buttons appear per row
  (a `pending` row shows Approve/Reject, a `draft` row shows Submit);
  illegal transitions are rejected in the model layer too, not just the
  UI; final statuses lock the record (no further moves, no delete)
- Every move is written to an **Approval History** relation manager on
  the record: from → to, who, comment, when
- Notifications land in the database bell (and mail) for the submitter
  or configured roles when a decision is made

### Automation: Scheduler (opt-in)

Time-based automation for your app. Enable the **Automation (Scheduler)**
module in the Technologies Stack tab, then design per-table rules in each
table's **Automation** tab. The generated app runs one lightweight
scheduler tick per minute — every rule fires **at most once per day or
period**, even across restarts (a `schedule_runs` bookkeeping table with a
unique index makes double-fires impossible).

**Date reminders** — notify a role N days before a date field's value
(e.g. 3 days before `due_date`). The reminder lands in the notification
bell and mail for the configured Shield roles.

**Recurring records** — auto-create a copy of the latest row on a fixed
cycle: daily, weekly (chosen weekday), or monthly (chosen day, clamped
for short months). Perfect for monthly bills, weekly reports, or any
"same record, every period" pattern. Optional notify on each creation.

**Scheduled backups** — enable in the Automation fieldset: dump the
database to `storage/app/backups` (gzip-compressed) daily or weekly,
with a retention count (oldest files pruned automatically). MySQL/
MariaDB uses `mysqldump --single-transaction`; SQLite copies the file
directly. Restore from the admin Scheduler page (super-admin only,
with a confirmation step; a safety copy of the current database is
written before every restore).

**Scheduler Status page** (admin → System → Scheduler): see every
compiled schedule, the backup files on disk, and the recent fire
history — plus a **Run scheduler now** button to trigger the runner
manually.

Deployment note: the generated app needs one crontab entry to drive
Laravel's scheduler daemon:

```
* * * * * cd /path/to/app && php artisan schedule:run >> /dev/null 2>&1
```

### File & Document Attachments (opt-in)

Real documents (invoices, claims, forms) need **many files per record**
with metadata — not one file per column. Two ways to enable:

- **Field-level**: set a field's media type to **Attachments
  (multi-file)**. The form gets a `multiple()` upload with your max-files,
  allowed-types, and max-size limits enforced in validation (not just
  php.ini). Files are stored on the **private** disk; every view/download
  goes through a **signed, expiring URL** — never a public link.
- **Table-level**: tick **Attachments** in Table Settings. Every record
  gets an **Attachments** relation manager (file list with name, size,
  uploader, date) with upload / download / delete — no schema change per
  table (polymorphic `attachments` table).

**Security model:** uploads land on the private `local` disk (not
`public/`), so a direct URL guess returns 403. Downloads use a
time-limited signed route (`fixzy.attachments.download`); a forged or
tampered URL is rejected. Upload metadata (who / when / original name /
MIME / size) is recorded, integrating with the Data Audit Trail.

### Public Intake Forms & Status Lookup (opt-in, per table)

Let guests submit records **without logging in** — complaints,
registrations, bookings, feedback. In Table Settings → **Public Form**:
pick a URL slug, tick which columns guests may submit, set the intro /
success text, initial status, and optional captcha + lookup page.

- **Public URL**: `/f/{slug}` — a lightweight standalone Blade page
  (not the admin panel). Server-side validation mirrors the table
  schema (required, type, max length).
- **Submissions** land in the normal table with a unique reference
  number (`PF-YYYYMM-XXXXXX`) and your chosen initial status, so the
  approval workflow picks them up automatically.
- **Status lookup**: `/f/{slug}/status` — guests enter their reference
  + email and see **status and last-updated only**. No record fields
  are ever exposed.

**Security model:** CSRF on every post; rate limit of 5 submissions
per minute per IP (per form); a hidden honeypot field that silently
drops bots; optional arithmetic captcha; unknown slugs 404 (no
enumeration); inserts are allowlist-only (only the columns you ticked
are ever read from the request).

### Auto Numbering (opt-in, per table)

Give any table race-safe reference codes — invoices, tickets, orders.
In Table Settings → Features → **Auto Numbering**: pick the target
column, a prefix (e.g. `INV`), a date part (`YYYY`, `YYYYMM`,
`YYYYMMDD` or none), and the sequence width. Sample:
`INV-202609-0001`.

The counter lives in a dedicated `numbering_sequences` table and is
incremented inside a database transaction with a row lock, so
**concurrent inserts never produce duplicate or skipped numbers**
(verified with 10 parallel inserts → 10 unique sequential codes).
Counters reset per period (daily/monthly/yearly) or never, depending
on the date part you choose. A manually typed value always wins —
auto numbering only fills empty fields on create.

### Reports & Charts (Dashboard Builder)

Widgets you design in the Dashboard Builder are **compiled into the
generated app's dashboard** — no manual wiring. Four widget types:

- **Stat card** — count / sum / avg of any table, optional filter
- **Bar chart** — group by a column, aggregate a numeric column
- **Pie chart** — share of a grouped aggregate
- **Latest records** — a compact table of the newest rows

Each widget carries its own width (1/2/3/full columns) and colour.
Filters support a simple field/operator/value rule, a timeframe
(today / this month / this year), and advanced AND/OR rule groups
from the visual query builder.

**Security model:** the compiled report config is baked into the
generated PHP as a protected static property — it never travels in
the Livewire payload, so it cannot be tampered with from the browser.
Column and table identifiers are validated against the live schema
plus a strict regex before use; all values go through query bindings.
Widgets whose table or field was later deleted are skipped at
generation time (no broken widgets).

### Smart Import / Export (opt-in, per table)

CSV/XLSX import with a reusable profile per table. In Table Settings →
Features → **Smart Import**: pick a **match field** (e.g. `email`,
`item_code`) and a mode:

- **Update** — matched rows are updated, new rows inserted (upsert)
- **Skip** — matched rows are left untouched, new rows inserted
- **Insert** — always insert (legacy behaviour)

The import flow is Filament's native 3-step wizard: upload → map CSV
columns to fields → run. Validation runs per row before anything is
saved; bad rows are reported with their line numbers and never
inserted. A **dry-run** checkbox (default configurable) validates the
whole file without persisting a single row — ideal for checking a
messy spreadsheet first.

Export supports **CSV and XLSX** natively (Filament v5 + OpenSpout,
no extra dependencies). Round-trip stability is verified: export →
re-import with an update profile leaves data byte-identical.

### Grid & Table View Options (opt-in, per table)

Beyond the six layout templates, Table Settings → Features exposes a
**Grid options** group — every item is a per-table choice, defaulting to
the classic behavior so existing apps are untouched:

- **Column chooser** (on by default): end users can show/hide and
  reorder columns per session via Filament's column manager. Tick off to
  lock the column set the designer defined. Only applies to the
  Horizontal template (Filament skips the manager on layout templates).
- **Sticky header**: column headers stay pinned while scrolling long
  lists. Implemented as a generated CSS asset (`public/css/fixzy-grid.css`)
  registered by a generated service provider — no Vite build needed.
- **Row density**: Normal / Compact / Comfortable row height.
- **Inline edit**: fields marked *Editable in table view* render as
  inline-editable columns (text input, toggle, or dropdown) directly in
  the grid. When off, those fields keep the legacy behavior (hidden from
  the grid). Security: every generated editable column carries an
  explicit `can('update')` authorization check plus server-side
  validation rules; primary keys, relationship lookups, calculated and
  media fields are never inline-editable.
- **Records per page**: pick the default page size and the choices
  offered to users (e.g. 10, 25, 50).

A live mock of these options renders in the Template preview pane as you
toggle them.

### Localization — Bahasa Melayu (opt-in)

Set the project language to **Malay** in Project Settings and the
generated app ships bilingual. English projects are untouched (zero
localization files emitted).

- **Admin chrome** — Filament v5 bundles native Malay translations
  ("Papan pemuka", "Log masuk", "Cipta"…) — activated automatically,
  no extra packages.
- **Validation messages** — a generated `lang/ms/validation.php`
  localizes error text (" Medan nama fakulti diperlukan.").
- **Your labels** — every field has an optional **Malay Caption**
  (BM) beside its English caption. Fields with a BM caption render as
  `__('fixzy.<table>.<field>')` backed by generated `lang/ms.json` +
  `lang/en.json`; fields without one keep their English label
  everywhere.
- **Live switcher** — an EN/BM toggle in the user-menu area; the
  choice persists per session (cookie), default follows the project
  language.

Filament v5 has no built-in locale-switch API (verified against
v5.8.4), so the module uses plain Laravel: a `SetLocale` middleware
reads the session and calls `App::setLocale()`, and the switcher
route only accepts the whitelisted `en`/`ms` codes — no third-party
plugin needed.

### REST API (opt-in)

Give external systems a clean JSON door into selected tables — no
Laravel knowledge required on the consuming side.

- **Token auth** — Laravel Sanctum bearer tokens. Create/revoke them
  in Admin → API Tokens (super-admin only).
- **Per-table control** — enable only the tables you want exposed,
  pick which Shield roles may read and which may write, and choose
  exactly which columns appear. Sensitive columns (passwords,
  tokens, secrets) are stripped at generation time — they can never
  leak, even if misconfigured.
- **Endpoints** — `GET /api/v1/{table}` (paginated list + simple
  filters), `GET /api/v1/{table}/{id}`, `POST` (create),
  `PUT /api/v1/{table}/{id}` (update). Writes are validated with
  the same rules as the admin form (required, max length, unique).
- **Rate limiting** — per-table, per-token requests/min (default
  60). Exceeding it returns HTTP 429.
- **Self-documenting** — the API Tokens page lists every exposed
  endpoint with its fields and required roles.

### Real-time Notifications & Chat (opt-in)

Push events to users instantly — no page refresh. Native-first: built on
Laravel's broadcasting and Filament's native notification bell; third-party
packages only where no native transport exists.

- **Live notification bell** — Filament `databaseNotifications()`, updated in
  real time over WebSocket
- **Chat module** — a ready-made private chat page (model, migration, event,
  private channels with per-user auth)
- **Backend choice:**
  - **Laravel Reverb** (default) — official first-party Laravel WebSocket
    server, self-hosted, no external account
  - **Pusher Channels** — hosted service, free tier, keys managed by admin
- **Graceful degradation** — if the Pusher SDK or WebSocket server is
  missing, the app still boots (broadcast falls back to log; chat messages
  still persist)
- **Security** — private channels authenticated per user; CDN scripts pinned
  with SRI hashes; keys entered by the admin on the in-app **Real-time
  Settings** page after deployment, never baked into generated code

### Google Sheets Sync (opt-in)

Two-way sync between your database and Google Sheets — built for teams that
live in spreadsheets. Enable the module per project, then tick **Enable
Google Sheets sync** on any custom table (core tables are guarded out).

- **"Create Google Sheet" button** — on each opted-in table's listing:
  creates the spreadsheet, pushes all rows, auto-shares it with the admin's
  Google account, and links it to the table
- **Two-way sync** — edits in the sheet flow into the database (new rows
  imported with identity backfill); edits made in Filament push back to the
  sheet automatically via model observers
- **Polling, not webhooks** — a scheduled job pulls the sheet every few
  minutes (runtime-configurable), no public endpoint or Pub/Sub setup needed
- **Conflict safety** — last-write-wins guard: a row whose database copy is
  fresher than the sheet copy is never overwritten; echo-loop protection
  keeps pull → push from ping-ponging
- **No-delete policy** — rows deleted in the sheet are ignored (the
  database stays the source of truth); deletes from the app remove the
  sheet row
- **Identity via `sync_uuid`** — every synced row carries a UUID in column
  A of the sheet and a `sync_uuid` column in the database; primary keys,
  file/image fields, and repeaters are excluded from sync
- **Security** — service-account JSON is pasted by the admin on the
  in-app **Google Sheets Settings** page, stored under
  `storage/app/private` (never in git); credentials are validated before
  saving

Verified end-to-end against a mock Google Sheets API (`test/gsheets_e2e.js`):
create/push/pull, new-row import, conflict resolution, delete propagation,
and echo-loop guard — 18/18 assertions.

### Authentication modules (opt-in, plug-and-play)

Tick a flag in the project settings and the generated app ships with the real
implementation — no manual wiring:

- **Google SSO** (`laravel/socialite`) — "Sign in with Google" button on the
  login page, OAuth callback, first-login user provisioning with `google_id`
  linking. Credentials are entered by the admin on an in-app **Auth Settings**
  page after deployment — never baked into the generated code.
- **LDAP / Active Directory** (`directorytree/ldaprecord-laravel`) — bind
  against your directory, automatic local-account provisioning, relaxed
  username rules (AD usernames need not be emails), graceful connection-error
  handling.
- **Email 2FA** — native Filament multi-factor authentication (no extra
  package).
- **Login captcha** — native arithmetic human-check on the login form (no
  external service).

All four combine on one login page as selected. The generated deployment guide
includes the matching setup checklist (Google Cloud Console steps, LDAP/AD
requirements, PHP extension notes).

### Workflow & hooks engine (Enterprise tier)

> **Availability:** the visual workflow / hooks engine is an **Enterprise-tier
> feature** of the no/low-code platform. Standard tiers do not include it.

Design automation visually on the node canvas — no hand-written glue code.
Workflows attach at two levels:

- **Table / model hooks** — `before/after insert · update · delete` with the
  changed record in context
- **Project hooks** — `after_login`, `before_logout`, `on_login_failure`,
  `after_user_created`, `before_user_deleted`, `on_scheduled_task`,
  `on_startup`

Every block on the palette compiles to real, readable PHP in the generated
app (observers, listeners, scheduled commands):

| Block | Compiles to |
|---|---|
| Send email | `Mail::raw` with `##variable##` interpolation (to/cc/bcc/subject/body) |
| Send Telegram | Bot API `sendMessage`; token from in-app settings, never in code |
| HTTP request | `Http::timeout(15)->withHeaders()->get/post/put/patch/delete` with output capture |
| Advanced Action | Multi-statement script: insert / update / delete + **parameterized raw SQL** (DDL and multi-statement injection rejected) |
| If / else-if / else | Nested conditional logic from the visual condition builder |
| Switch | `switch/case/default` routed by connection points |
| For-each loop | Iterate lists with per-item actions |
| Data transformer | Date formatting, case conversion, validated math (never `eval`) |
| Try / catch | Error branch executes when connected |
| Variable / terminate / comment | Flow control and documentation |

Runtime secrets (SMTP password, Telegram bot token) are entered by the admin
on in-app **Mail Settings** / **Telegram Bot Settings** pages after
deployment — never baked into generated code or git.

### Target stacks

| Stack | Status |
|---|---|
| Laravel 12 + Filament 5 (PHP) | ✅ Production-ready — the benchmark |
| Additional stacks (Node, others) | 🔜 Planned — the IR is stack-neutral by design |

The design model (tables, fields, relationships, menus, widgets) is captured in a
stack-neutral IR, so a new target stack is a new generator plugin — not a new app.
See `docs/IR_SCHEMA.json` and `docs/IR_MAPPING.md`.

### Live preview
Click **Show Preview** to run the generated app instantly in a sandboxed local
environment — log in, click around, and see your design before exporting.

### Multi-tenancy & auditing
Row-level ownership, tenant scoping (single and multi-tenant patterns), and
generated native logging — a per-record Data Audit Trail plus an optional
per-user Activity Log. No third-party auditing package required.

### Custom modules (views of your tables)

A **Custom Module** is a filtered, reshaped view of an existing table — a
different slice of the same data for a different audience (e.g. a "My
Faculty Staff" view of the full Staff table). Custom modules are **not**
a second class of citizen: they now support the same layout power as
main modules.

- **Form layout per module** — every form style (default, grouped,
  wizard, accordion, inline, survey, checkout, modal, conversational)
  can be overridden per custom module. Edit it in the module's
  **Form Design** tab; a badge shows whether the layout is *Inherited
  from main module* or *Overridden for this module*, with one-click
  **Reset to main module**.
- **All grid settings overridable** — column set/order, template,
  density, sticky header, page size, inline edit, card size: anything
  the main module exposes can be overridden per custom module.
- **Kanban / Calendar / Tree per module** — a custom module can render
  as its own kanban board, month calendar, or hierarchy tree, each
  opt-in with its own field mapping.
- **Conversational (chat) forms per module** — a module whose own
  layout is conversational gets its own `/chat/{slug}` page; slug
  collisions auto-suffix. Modules inherit nothing here, so no
  duplicate routes ever appear.
- **Field behavior per module** — show/hide, required, and help text
  set inside a custom module apply to that module only; they never
  leak into the main table.
- **Unsupported features are shown, not hidden** — features that are
  inherently table-level (approvals, public forms, REST API, auto
  numbering) appear disabled in a custom module's settings with a
  tooltip explaining why, so nothing feels "missing".

### Starter Packs (pre-composed templates)

Need a head start? The **Starter Packs** gallery (Project Settings →
Core Modules → Starter Packs) installs pre-composed templates — tables,
relations, menu groups, approval workflows, kanban/calendar boards, and
auto-numbering — with one click.

Five packs ship today:

| Pack | Domain | Highlights |
|---|---|---|
| Leave Request | HR | Multi-step approval workflow (draft → pending → manager review → approved/rejected) |
| Booking & Reservation | Scheduling | Resources + bookings, calendar view, daily booking refs |
| Helpdesk Tickets | Support | Tickets + replies, kanban board, urgent queue, ticket numbering |
| Job / Work Order | Operations | Numbered jobs + task checklists, active-jobs filter |
| CRM Lite | Sales | Contacts, leads pipeline kanban, activity log |

**Important: Starter Packs are NOT complete, ready-to-run business
systems.** They are jump-start templates. Everything a pack installs is
ordinary designer content — every table, field, and workflow rule can be
edited, removed, or extended to match your needs. Review and adjust the
configuration before generating. Each pack's preview modal spells out
its caveats (e.g. the booking pack does not prevent double bookings out
of the box).

Authoring your own packs is supported too: a pack is a declarative JSON
manifest (see `src/presets/SCHEMA.md`) — no generator code required.

### Form Layout Designer

Every table (and custom module) form can be redesigned visually — no
code. Nine styles ship built-in:

| Style | Shape |
|---|---|
| Default | Classic single-column Filament form |
| Grouped | Fieldsets with headings, multi-column grids |
| Wizard | Multi-step with progress bar and step validation |
| Accordion | Collapsible sections, first-open configurable |
| Inline | Compact label-beside-field layout |
| Survey | Question-per-block with required markers |
| Checkout | Summary sidebar + stepped fields |
| Modal | Small dialog form for quick edits |
| Conversational | Chat-driven form (`/chat/{slug}`) — the bot asks field by field |

The designer stores its config as JSON on the table (or the custom
module's override), and the generators compile it into native Filament
v5 schemas — wizards become real Filament wizards, conversational forms
become a Livewire chat component. Conditional visibility, field
grouping, and required rules all survive to the generated code.

## Roadmap

Shipped:
- [x] Multi-stack architecture: stack-neutral IR + pluggable generators
- [x] Laravel + Filament generator (full stack: DB, models, resources, I/O) — benchmark target
- [x] Desktop (Windows/macOS), local web UI, and headless CLI from one engine
- [x] SQL import (MySQL, PostgreSQL, SQL Server, SQLite)
- [x] Multi-tenancy, row ownership, native logging (Data Audit Trail +
  User Activity Log, independently selectable)
- [x] Dashboard builder with stat/chart widgets
- [x] Auth modules: Google SSO, LDAP/AD, 2FA — email code or Google Authenticator
      (TOTP, recoverable), login captcha — built-in arithmetic or Google
      reCAPTCHA v2 (opt-in)
- [x] Real-time notifications & chat (opt-in): live bell + chat over Laravel
  Reverb (self-hosted) or Pusher (hosted), graceful degradation, SRI-pinned
  CDN assets
- [x] Google Sheets sync (opt-in): two-way sync of custom tables — create &
  share sheet, polling pull, observer push, conflict guard, no-delete policy
  (e2e-tested against a mock Sheets API)
- [x] **Enterprise:** visual workflow & hooks engine — full block palette
  (email, Telegram, HTTP, Advanced Action/raw SQL, logic, loops, try/catch)
  compiling to real PHP (observers, listeners, scheduled commands)
- [x] GUI Setup Wizard (one-click environment provisioning)
- [x] Form Layout Designer — 9 form styles (default, grouped, wizard,
  accordion, inline, survey, checkout, modal, conversational) compiled
  to native Filament v5 schemas
- [x] Custom module layout parity — every form style, all grid
  settings, kanban/calendar/tree, and conversational chat forms
  overridable per custom module (inherited-vs-overridden badges,
  reset-to-main)
- [x] 83-fixture golden test matrix + CI (Windows + ubuntu + macOS)

Next:
- [ ] Guided project templates (CRM, inventory, booking, helpdesk starters)
- [ ] Project files: save/open designs as portable `.fixzy` files
- [ ] Workflow engine: intake → route → process → notify → track
- [ ] Additional target stacks beyond Laravel + Filament
- [ ] In-app update channel for the desktop app

Roadmap items are community-friendly — open an issue to vote or request.

## Development

```bash
node test/golden.js                 # 51-fixture snapshot matrix
node test/e2e_smoke.js <fixture>    # generate + migrate + boot + HTTP check
node test/gsheets_e2e.js            # Google Sheets sync vs mock Sheets API
node test/pathguard_test.js         # security unit tests
node test/audit_headless.js         # generator crash audit
```

CI runs the full matrix on **Windows**, ubuntu, and macOS
(`.github/workflows/ci.yml`) — Windows is the primary target OS, so every
push is verified there too.

Key docs: `docs/FAQ.md`, `docs/FEATURE_MATRIX.md`, `docs/NATIVE_FEATURES.md`,
`docs/HEADLESS_WEB.md`, `docs/BUGS.md`.

Architecture: the app stores your design in a local SQLite database; generators
are pure functions that turn the schema into PHP files. The same IPC handler
registry powers Electron, the web shim, and the CLI — one engine, three shells.

## Security

- Binds to `127.0.0.1` by default; remote binding requires an explicit opt-in
- Output paths are allowlisted; traversal/symlink escapes are rejected
- Electron `contextIsolation` on, no `nodeIntegration`, CSP localhost-only
- Report vulnerabilities privately — see `SECURITY.md`

## License

Fixzy SysMaker is released under a **Non-Commercial license** (see
[`LICENSE.md`](LICENSE.md)): free for personal, educational, research,
government, and non-profit use. Commercial licensing is available — contact
mohdhafizi83@gmail.com.
