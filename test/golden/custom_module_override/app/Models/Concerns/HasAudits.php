<?php

namespace App\Models\Concerns;

use App\Observers\AuditObserver;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Native audit trail (Fixzy SysMaker generated code — replaces
 * 3rd-party auditing packages).
 *
 * Attach to any model that should record an audit trail. Every create/update/
 * delete is logged to the `audits` table by App\Observers\AuditObserver.
 */
trait HasAudits
{
    /**
     * Boot the trait: register the audit observer once per model.
     */
    public static function bootHasAudits(): void
    {
        static::observe(AuditObserver::class);
    }

    /**
     * All audit records for this model instance.
     */
    public function audits(): MorphMany
    {
        return $this->morphMany(\App\Models\Audit::class, 'auditable');
    }
}
