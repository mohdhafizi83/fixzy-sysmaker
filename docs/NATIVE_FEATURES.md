# Native Features (Phase 4)

Goal: generated apps depend on Filament core + first-party packages ONLY.
Peripheral 3rd-party plugins are replaced with generated native app code.

## Plugin inventory (before Phase 4)

| Plugin | Purpose | Where referenced | Native replacement | Status |
|---|---|---|---|---|
| `owen-it/laravel-auditing` | Eloquent audit trail (model-level) | Models (`Auditable` contract+trait) | `App\Models\Audit` + `App\Observers\AuditObserver` + `App\Models\Concerns\HasAudits` + `audits` migration | REPLACED |
| `tapp/filament-auditing` | Filament UI for audit trail | Resources `getRelations()`, AdminPanelProvider Livewire registration | `App\Filament\RelationManagers\AuditsRelationManager` (read-only table) | REPLACED |
| `bezhansalleh/filament-shield` | RBAC / permission UI | AdminPanelProvider plugin, User `HasRoles`, ShieldSeeder | KEPT — RBAC is a core concern with deep generated integration (spatie/laravel-permission underneath). Replacing = redeveloping a permission system; out of scope per ground rule "Filament core is NOT redeveloped". | KEPT (documented exception) |
| `spatie/laravel-permission` | Permission engine (Shield dependency) | User model `HasRoles` | KEPT (transitive of Shield) | KEPT |
| `App\Filament\Actions\PrintAction` | Print button (was skeleton-only file) | Resources with `allow_print_view` | Now GENERATED into every app that enables print (template `app/Filament/Actions/PrintAction.php.njk`) | FIXED (was missing from generated output — dangling `use` before Phase 4) |

## Native audit design

- `audits` table: polymorphic (`auditable_type`/`auditable_id`), event,
  user_id, old/new JSON values, url/ip/user_agent. Indexed on
  (auditable_type, auditable_id) and user_id.
- `HasAudits` trait registers `AuditObserver` via `bootHasAudits()`.
- `AuditObserver` records created/updated/deleted; strips
  `password`/`remember_token`/`password_confirmation` from stored values.
- `AuditsRelationManager` is a read-only Filament RelationManager over the
  `audits()` morphMany. Attached to resources when
  `project.module_log_audit === 1` (permission-gated as before via
  `view_any_audit`).
- Feature flag: `project.module_log_audit`. When 0, none of the native
  audit files are generated.

## Native tenancy design

- 1:m: `App\Models\Concerns\BelongsToTenant` trait +
  `protected $tenantForeignKey = '<fk>'` on the model. Auto-fills the FK
  from the authenticated user on create (same semantics as the previous
  inline boot() code, now formalized/reusable).
- m:m: unchanged — Filament core `HasTenants` contract on User
  (`belongsToMany` via generated `<tenant>_user` pivot) + panel
  `->tenant()`. This is FIRST-PARTY Filament functionality, not a
  peripheral plugin, so it stays.

## Verification

- Golden matrix: `grep -r "Tapp\|OwenIt" test/golden/` = 0 hits.
- `auditing_on` fixture e2e: create/update/delete each produce an audit
  row (verified via tinker: events created/updated/deleted recorded with
  old/new values).
- `tenancy_1m` fixture: Kela model uses BelongsToTenant with
  `$tenantForeignKey = 'sekolah_id'`.
- `tenancy_mm` fixture: User implements HasTenants (Filament core),
  pivot migration generated, no bogus FK (BUG-003 fix).
