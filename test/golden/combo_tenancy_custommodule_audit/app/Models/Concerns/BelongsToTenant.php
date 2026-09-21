<?php

namespace App\Models\Concerns;

/**
 * Native tenant ownership trait (FiziSysMaker generated code).
 *
 * Models using this trait belong to a tenant (one-to-many tenancy).
 * The tenant foreign key is auto-filled from the authenticated user on create.
 *
 * The using model must declare:
 *   protected $tenantForeignKey = '<fk_column>';
 *
 * Read scoping is intentionally NOT added here — the generated app keeps its
 * existing read semantics (panel-level tenant context handles m:m; 1:m lists
 * follow the pre-existing unfiltered behavior). Add a global scope here if a
 * project needs stricter isolation.
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::creating(function ($model) {
            $foreignKey = $model->tenantForeignKey ?? null;
            if (!$foreignKey) {
                return;
            }
            if (empty($model->{$foreignKey}) && auth()->check()) {
                $model->{$foreignKey} = auth()->user()->{$foreignKey} ?? null;
            }
        });
    }
}
