# Guard Rules — Input Interlocks & Validation Matrix

Verified live via Playwright on 2026-09-22 (S3 sweep). These rules govern which
inputs are enabled/disabled/forced based on other selections. Any change to
`projectHandlers.js`, `dashboard.js`, `fieldHandlers.js`, or `tenancyManager.js`
must keep these invariants.

## 1. Stack selection (Technologies Stack section)

| Control | Rule | Verified |
|---|---|---|
| `app-stack_base` | Only `laravel_filament` enabled. All 16 other stacks disabled (future targets). | YES |
| `app-stack-database` | For laravel_filament: only `sqlite` enabled; mysql_mariadb/postgresql/sql_server disabled. Hidden groups get `id=''` so they never save. | YES |
| `app-stack-theme` | Only `fixzySys` enabled; `brisk`, `nord_theme` disabled. | YES |
| Detail groups | `updateStackDetails()` shows only groups whose `data-stack-ref` matches selected stack group. | YES |

Note: existing project row may still hold `stack_database=mysql_mariadb` from
before the guard — the UI cannot re-save it while hidden (by design).

## 2. Authentication modules (Modules Setup)

| Control | Rule | Verified |
|---|---|---|
| `app-module-auth-email` | Always checked + DISABLED (Email & Password is mandatory base). | YES |
| `app-module-auth-email-2fa` / `app-module-auth-email-captcha` | Same radio group `app-module-auth-extra` = mutually exclusive. Deselectable (click checked radio to uncheck). Persisted as two int columns. | YES (after fix) |
| `app-module-auth-ldap`, `app-module-auth-google-sso` | Independent checkboxes. | YES |
| `app-module-authorization` | Independent checkbox (RBAC layer). | YES |

### Fix applied 2026-09-22 (BUG-013)
The 2FA/Captcha radios had no `value` attribute; the generic radio save path
stored `"on"` into INTEGER columns (→ 0) and never persisted a deselect.
`dashboard.js handleInputChange` now special-cases `app-module-auth-extra`:
checking one writes `1` to its column and `0` to the other; deselect writes
`0` to its own column. Verified round-trip:
- captcha on → captcha=1, 2fa=0
- 2fa on → 2fa=1, captcha=0
- deselect 2fa → both 0

## 3. Models Design guards

| Control | Rule | Verified |
|---|---|---|
| "+ Field" button | Disabled until a table is selected. | YES |
| Table select → field list | Fields render only for active table. | YES |

## 4. Field settings guards (data_type matrix)

Verified across 12 data types (S2.4). Key interlocks:

| Trigger | Effect |
|---|---|
| data_type = DECIMAL | length + precision groups enabled (precision default 2) |
| data_type = INT family | unsigned / zero-fill enabled; precision disabled |
| allow_image_uploads ON | `fld-delete-image-server` + `fld-dont-rename-image` become ENABLED |
| allow_image_uploads OFF | both become DISABLED again |
| allow_file_uploads ON | `fld-delete-file-server` + `fld-dont-rename-file` ENABLED |
| display_type = image/file | auto-sets allow_image/file_uploads = 1 |
| data_type = JSON | tv_wrap_text auto-set |
| date/datetime + range filter | date-time-format default filled |
| repeater groups | required checkboxes only when repeater options visible |

Save semantics: text/number inputs persist on `focusout` (not `change`);
checkbox/select persist on `change`. Radio deselect handled per §2.

## 5. Tenancy wizard

| Scenario | Rule | Verified |
|---|---|---|
| Pick one_to_many / many_to_many | Wizard opens immediately. | YES |
| Cancel wizard | Radio reverts to current persisted type (`revertRadioToCurrentState`). | YES |
| Switch back to standard | Rollback of tenant FK settings runs. | code-reviewed |

## 6. Numbered bug references

- BUG-013: 2FA/Captcha radio persistence (fixed, this file §2)
- See docs/BUGS.md for the full sweep log.
