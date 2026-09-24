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

## General

### Do I need Laravel knowledge to use the generated app?

No for basic use — the app is a complete admin panel out of the box.
Basic PHP/Laravel helps if you want to customize beyond what Fixzy
SysMaker exposes.

### Is the generated code locked or minified?

Never. Every generated file is plain, readable PHP/Blade. You own it.

### Where do I report bugs or request features?

Open an issue on the repository. See `docs/BUGS.md` for known issues and
their status.
