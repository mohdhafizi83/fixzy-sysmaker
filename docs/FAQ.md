# Frequently Asked Questions

## Logging

### What is the difference between "Data Audit Trail" and "User Activity Log"?

They answer two different questions:

| | Data Audit Trail | User Activity Log |
|---|---|---|
| Question it answers | **Who changed what data?** | **What did users do in the app?** |
| Records | Create / update / delete on your models, with before-and-after values, user, URL, IP | Sign-in, sign-out, failed sign-in attempts |
| Where you see it | Read-only "Audits" tab on every record's page | Admin-only "Activity Log" page with filters |
| Storage | `audits` table | `activity_logs` table |

### Can I enable only one of them?

Yes. The two logs are fully independent:

- **Data Audit Trail only** — per-record change history, no sign-in tracking.
- **User Activity Log only** — sign-in/out/failed tracking, no data-change
  history.
- **Both** — you get everything, plus a bonus: the Activity Log page gains
  a second tab ("Data changes") showing every create/edit/delete the
  selected user made across **all** tables — a per-person activity feed.

### Does the User Activity Log slow down or break login?

No. It listens to Laravel's native auth events (`Login`, `Logout`,
`Failed`) as a passive observer. Every write is wrapped in its own error
handling — if the activity insert ever fails, the login itself still
succeeds and the error goes to the application log instead.

### Are passwords ever recorded?

No. Failed sign-in attempts store only the **attempted account name**
(needed to investigate attacks) — never the password. In the Data Audit
Trail, password and token columns are stripped from stored values on every
event.

### Who can see the logs in the generated app?

- **Data Audit Trail**: users who can view a record see its Audits tab
  only if they hold the `view_any_audit` permission (super admin always).
- **User Activity Log**: super admin always. With Shield (Group-Based
  Permissions) enabled, the page is gated by a `view_any_activity_log`
  permission — create it in the Shield Roles UI and assign it to the
  roles that should see the page. Regular users cannot see anyone's
  activity by default.

### Is this a third-party package?

No. Both logs are generated as plain native code — migrations, models,
an observer, a listener, a service provider, and a Filament page. No
`owen-it/laravel-auditing`, no `tapp/filament-auditing`, no external
service. You own and can edit every file.

### Can I change the logging choice after generating?

Yes — the choice is a project setting. Toggle it and regenerate/deploy the
update; the generator adds or removes the module files and registers the
service provider idempotently (no duplicates on repeated runs).

### How do I deep-link to a specific user's history?

The Activity Log page accepts query parameters:

```
/admin/activity-log?user=1&tab=data&from=2026-09-01&to=2026-09-30
```

`tab=data` opens the per-user data-change feed (requires the Data Audit
Trail to be enabled).

## Scheduler (Automation)

### How does the scheduler work in the generated app?

One cron entry drives everything: `php artisan schedule:run` ticks every
minute, and the generated `fixzy:schedule-run` command checks each
compiled schedule (reminders, recurring records) to see if it is due.
You never add per-rule cron entries.

### Can a reminder fire twice?

No. Every fire is claimed in a `schedule_runs` table with a unique index
on (kind, table, record, date). A second attempt on the same day is a
silent no-op — even if the server restarts mid-run or two workers race.

### What does "recurring record" actually copy?

It replicates the most recently created row of the table (all column
values) as a brand-new record each period. Edit the latest row before the
cycle and the next period picks up your changes. If the table is empty,
one blank row is seeded so the cycle can start.

### Where do reminders go?

The same channels as approval notifications: the in-app notification
bell (database channel) and mail for users who have an address. Recipients
are Shield role names (comma-separated); `admin` maps to `super_admin`.

### How do I test the scheduler without waiting for the due date?

Use the **Run scheduler now** button on the admin Scheduler page, or run
`php artisan fixzy:schedule-run --force` — force mode fires every entry
whose date is today or later, ignoring the exact offset window.

### Is the restore safe? What if I restore the wrong backup?

Every restore writes a safety copy of the current database
(`database/pre-restore-<timestamp>_…`) before overwriting, so you can
recover by copying it back. Restore is gated to super admins, requires
a confirmation step, and only accepts files matching the exact backup
naming pattern (no path traversal). For MySQL, restoring through the
web UI is intentionally disabled — the page shows the shell command
instead, so live DB credentials never flow through a UI action.

## Attachments (Files & Documents)

### What is the difference between a field upload and table attachments?

A **field upload** (media type "Attachments (multi-file)") stores files
in that one field — good when a record has a defined set of documents
(e.g. an invoice's PDFs). **Table attachments** (tick "Attachments" in
Table Settings) give every record a shared attachment list with no
schema change — good for free-form documents on any table.

### Are uploaded files public?

No. Attachments are stored on the **private** `local` disk, never in
`public/`. A direct URL guess returns 403. Every download goes through
a **time-limited signed URL** — a forged or tampered link is rejected.

### Can I limit file size and type?

Yes. Field-level attachments let you set max files, allowed types
(pdf/jpg/png/…), and max size per file. The limits are enforced in form
validation, not just left to php.ini.

### Who can see who uploaded a file?

Every attachment records the uploader, timestamp, original filename,
MIME type, and size. With the Data Audit Trail enabled, changes to
attachments are also captured in the audit history.

## Public Intake Forms

### Can guests submit data without an account?

Yes. Enable **Public Form** on any table and you get a guest-facing
page at `/f/{slug}`. Guests can only submit the columns you ticked —
everything else (owner, internal statuses, audit fields) is never
readable or writable through the public route.

### How do guests track their submission?

Each submission gets a reference number (e.g.
`PF-202609-A1B2C3`) shown on the success page. If you enable the
lookup page, guests enter that reference **plus their email** at
`/f/{slug}/status` and see only the current status and last-updated
time — never the record contents.

### Won't bots spam the public form?

Four layers: a rate limit (5 submissions per minute per IP per
form), a hidden honeypot field that silently drops bots, an optional
arithmetic captcha, and CSRF protection on every post. Unknown form
slugs return 404 so attackers can't enumerate your tables.

## Auto Numbering

### Can two records get the same reference number?

No. The counter is incremented inside a database transaction with a
row lock, so even 10 simultaneous inserts produce 10 unique
sequential codes (this is tested, not assumed).

### Can I still type my own number?

Yes. Auto numbering only fills the field when it's empty on create.
If an admin types `INV-2026-0001` manually, that value is kept.

### When does the sequence restart?

Depends on the date part: `YYYYMM` restarts monthly (0001 each new
month), `YYYY` yearly, `YYYYMMDD` daily, and no date part means the
counter runs forever.

## Reports & Charts

### Where do my Dashboard Builder widgets show up?

They are compiled into the generated app's dashboard. Each widget
becomes a small PHP class under `app/Filament/Widgets/` and the
dashboard page lists them automatically. Re-generate after changing
widgets in the builder.

### Can a user tamper with a report's query from the browser?

No. The compiled config is baked into the generated PHP as a
protected static property — it never travels in the Livewire
payload. Table/column identifiers are validated against the live
schema plus a strict regex, and all filter values go through query
bindings.

### What happens if I delete a table a widget points to?

The widget is skipped at generation time — you won't get a broken
chart or a crash. Remove or repoint the widget in the Dashboard
Builder.

### How do I make a widget update in real time?

In the widget's Data & Filtering tab, set **Live Updates** to
**Real-time (WebSocket push)**. This auto-includes the Real-time
module (Reverb) in your project. After deploying: fill in the
WebSocket credentials on the in-app Real-time Settings page and
run `php artisan reverb:start`. Any create/update/delete on the
widget's source table then refreshes the widget within about a
second (broadcasts are debounced to one wave per table per 2 s,
so bulk imports don't flood the socket).

If you don't want to run a WebSocket server, choose **Auto-refresh
(polling)** instead — same visual result, just a few seconds of
latency, zero extra infrastructure.

### What is Kiosk Display Mode?

A wall/TV presentation of your dashboard widgets at `/kiosk`
(enabled in the Dashboard Builder). It auto-rotates through pages
of widgets (rotate interval and page size configurable), renders
stats in large type, shows a live clock, and lights a LIVE badge
when the WebSocket is connected. It shares the same widgets as the
admin dashboard — no duplicate setup. The page is hidden from
navigation; open it directly on the TV browser.

Note: `/kiosk` requires an authenticated admin session (it lives
inside the Filament panel). For a public wallboard, keep an admin
session logged in on that machine.

## Smart Import / Export

### What's the difference between update, skip, and insert mode?

They decide what happens when an imported row's match field (e.g.
`email`) already exists in the table. **Update** overwrites the
existing row with the imported values. **Skip** leaves the existing
row completely untouched. **Insert** ignores matching entirely and
always creates a new row (the classic behaviour).

### Can I check a messy file before committing it?

Yes — tick **Dry run** on the import dialog. Every row goes through
the full validation pipeline (required fields, rules, type casts) and
you get the per-row error report, but nothing is written to the
database. Fix the file, re-run for real.

### Does export support Excel?

Yes. Exports offer both CSV and XLSX (Filament v5 native, via
OpenSpout — no extra packages). Round-trip is stable: export a
table, re-import with an update profile, and the data comes back
identical.

## Localization (Bahasa Melayu)

### How do I make the admin panel Malay?

Set the project language to **Malay** in Project Settings, then
regenerate. The admin chrome (buttons, pages, validation) comes from
Filament's bundled Malay translations automatically.

### Can I mix languages — some labels English, some Malay?

Yes. Each field has an optional **Malay Caption**. Fields with one
show the Malay caption when the locale is BM and the English caption
when it's EN. Fields without a Malay caption keep their English label
in both languages.

### Does English projects get any localization overhead?

No. English projects emit zero localization files — the generated
output is byte-identical to a project without the module.

### Where does the language switch persist?

Per user session (cookie). Each user can browse in their preferred
language; the default follows the project setting.

## REST API

### How do external systems read/write my data?

Enable the REST API per table in the table settings, regenerate,
then create a token in Admin → API Tokens. Send it as
`Authorization: Bearer <token>` to `/api/v1/{table}`.

### Can a token read everything?

No. Access is per table and per direction: each table has separate
read and write role lists (Shield roles). A token acts with its
owner's roles — if the owner lacks the write role, POST/PUT return
403 even with a valid token.

### Are sensitive columns ever exposed?

Never. Columns matching password/token/secret patterns are stripped
from the API allowlist at generation time, even if explicitly
listed. The audit suite enforces this.

### Is there rate limiting?

Yes — per table, per token (default 60 requests/min, configurable).
Exceeding it returns HTTP 429 with a retry hint.

## Login Security (2FA & Captcha)

### What's the difference between the two 2FA modes?

Both add a second step after the password; they differ in where the code
comes from:

| | Basic (email code) | Google Authenticator (TOTP) |
|---|---|---|
| Code delivery | 6-digit code emailed to the user | Code generated in the user's authenticator app |
| Setup per user | None — just sign in | Scan a QR code once (Settings → Security) |
| Needs mail server | Yes | No |
| Works offline | No | Yes (codes are time-based, ~30s each) |

The TOTP mode uses Filament's native multi-factor engine
(`Filament\Auth\MultiFactor\App`) — not a custom crypto implementation.
Recovery codes are generated so a lost phone doesn't lock anyone out.

### What's the difference between the two captcha modes?

- **Basic** — a built-in arithmetic challenge (e.g. "7 + 5 = ?").
  Verified locally; zero external services, zero keys, zero cost.
- **Google reCAPTCHA v2** — the "I'm not a robot" checkbox. Stronger
  bot protection (Google scores behaviour), but you must register your
  site at google.com/recaptcha and paste the site key + secret into the
  generated app's Auth Settings page. Keys are never baked into code.

### Is the captcha verification fail-closed?

Yes. If the secret key is missing, the verification call fails, or the
token is invalid/expired, the login is **rejected** — there is no silent
pass path. (This was verified by direct testing, not just code review.)

### Can I use 2FA and captcha together?

Yes — they're independent toggles. Captcha guards the password step
(against automated credential stuffing); 2FA guards the account itself
(against a stolen password). Combining them is the recommended setup for
anything internet-facing.

### Does enabling Google Authenticator change the database?

One extra migration adds two encrypted columns to the users table
(`app_authentication_secret`, `app_authentication_recovery_codes`).
Secrets are stored encrypted at rest — verified: the stored bytes are
ciphertext, and only the app with your `APP_KEY` can read them back.

## Custom Modules & Form Layout

### What is a Custom Module?

A **Custom Module** is a saved, filtered view of an existing table — the
same data, reshaped for a different job. Example: the full `Staff`
table plus a "My Faculty Staff" custom module that filters to one
faculty, shows fewer columns, and uses a simpler form. The data lives
in one place; the module is just a lens.

### Can a custom module use the same form layouts as the main module?

Yes — all of them. Default, grouped, wizard, accordion, inline,
survey, checkout, modal, and conversational can each be set per
custom module in its **Form Design** tab. If you don't override
anything, the module inherits the main table's form layout.

### How do I know if a setting is mine or inherited?

Every override surface shows a badge:

- **Overridden for this module** (green) — this module has its own
  value; the main module is unaffected.
- **Inherited from main module** (grey) — the module follows the main
  table's setting.

A **Reset to main module** button clears the override and goes back
to inheriting.

### If I edit a custom module, does the main table change?

No. Changes made inside a custom module (form layout, grid settings,
field behavior) are stored as a module-level override and apply to
that module only. The main module and other custom modules are
untouched. A banner in the workspace reminds you which module you're
editing.

### Can a custom module have its own kanban / calendar / tree?

Yes. Each of those views is opt-in per custom module with its own
field mapping (status field for kanban, date field for calendar,
parent field for tree). They generate as standalone pages, just like
the main module's versions.

### How do conversational (chat) forms work for custom modules?

Set the module's own form style to **conversational** and it gets a
chat page at `/chat/{slug}` — the bot asks one field at a time and
builds the record. The module gets the chat route only if its **own**
override is conversational; inheriting the chat style from the main
table deliberately does not create a second route (that would
duplicate the main module's page). If two slugs collide, the
generator auto-suffixes (`staff-chat-2`).

### Why are Approvals / Public Form / REST API disabled in a custom module?

Because they are inherently table-level: an approval workflow, a
public intake form, or an API endpoint operates on the real table and
its lifecycle — two modules can't run two different state machines on
one table. Instead of hiding them, Fixzy SysMaker shows them disabled
with a tooltip explaining why. Configure them on the main table.

### Does the conversational chat form validate input?

Yes. Required rules, max lengths, and field types from the schema are
enforced server-side on every submitted answer — the chat UI is a
friendlier front door, not a bypass.

## Starter Packs

### Are Starter Packs complete business systems?

No — and this is by design. A Starter Pack is a pre-composed *template*:
tables, relations, menu groups, and workflow configuration that give you
a 30-minute head start instead of a blank canvas. It is not a finished
leave-management / booking / CRM product. Review the pack's preview
caveats and adjust the configuration to your needs before generating.

### Can I change what a pack installed?

Everything. A pack installs ordinary designer content — the same tables,
fields, relations, and custom modules you could create by hand. Edit
fields, add tables, delete the custom module views, rewire the approval
workflow: nothing a pack installs is locked.

### What happens if a pack's table names clash with my existing tables?

The installer refuses to run and lists the conflicting names. Nothing
partial is written. Rename or remove your existing tables first, or
author your own pack variant with different names.

### Can I author my own Starter Packs?

Yes. A pack is a declarative JSON manifest — see `src/presets/SCHEMA.md`.
Drop it in `src/presets/` and it appears in the gallery automatically.
No generator code needed.

### Why is there no accounting / payroll / invoicing pack?

Deliberately out of scope. Double-entry bookkeeping, tax rules, and
payroll calculations carry correctness obligations a template generator
should not pretend to own. Packs that touch money are labeled
"tracking only" and stop there.

## General

### Which databases does the generated app support?

SQLite (default), MySQL/MariaDB, and PostgreSQL — plus cloud PostgreSQL
providers: Supabase, Neon, and managed RDS/Cloud SQL. Pick the engine per
project in the Technologies Stack tab; the generated `.env` defaults,
deployment guide, and deploy provisioner all follow your choice.

For Supabase specifically: use the **session-mode** pooler (port 5432) or
a direct connection. Do not use transaction-mode pooling (port 6543) —
it breaks Laravel's prepared statements.

### Why no MongoDB / Cassandra / DynamoDB / Couchbase?

The generated app is a relational admin panel: foreign keys, joins, and
SQL aggregation power every list, relation manager, and chart. NoSQL
engines cannot express those without redesigning the entire product, and
the community Laravel drivers for them are incomplete. We support the
SQL family well instead of supporting everything shallowly.

### Do I need Laravel knowledge to use the generated app?

No for basic use — the app is a complete admin panel out of the box.
Basic PHP/Laravel helps if you want to customize beyond what Fixzy
SysMaker exposes.

### Is the generated code locked or minified?

Never. Every generated file is plain, readable PHP/Blade. You own it.

## MCP (AI assistant integration)

### What can AI assistants do with Fixzy SysMaker?

Run `fixzy mcp` and any MCP-capable assistant (Claude Desktop, Cursor,
Windsurf, ...) can drive the same engine the GUI uses: list projects,
read and validate schemas, create projects/tables/fields/relationships,
and generate the Laravel + Filament app — all from natural-language
conversation. The AI never free-writes application code; every step goes
through the same validation the GUI enforces. Full reference:
`docs/MCP.md`.

### Is it safe to let an AI touch my projects?

By default the server is **read-only** — it can inspect but not change
anything. Schema mutation needs `--allow-write`, generation needs
`--allow-generate`, and every output path is checked against the same
allowlist as the CLI (traversal and symlink escapes are rejected).
Deploy, update, and composer controls are deliberately never exposed as
MCP tools: touching a live deployment stays a human decision.

### Does the MCP server replace the GUI?

No — it's a second door into the same room. The GUI is best for visual
design; MCP is best for bulk or conversational work ("add an audit
status field to all 12 tables") and for wiring Fixzy SysMaker into AI
workflows. Both write to the same store, so you can mix freely: design
80% by hand, let the assistant finish the rest.

### Where do I report bugs or request features?

Open an issue on the repository. See `docs/BUGS.md` for known issues and
their status.
