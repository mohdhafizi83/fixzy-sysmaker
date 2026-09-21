<?php

namespace App\Observers;

use App\Models\Audit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Native audit observer (FiziSysMaker generated code).
 *
 * Records create/update/delete events for models using App\Models\Concerns\HasAudits.
 * Sensitive fields (password, remember_token) are never stored.
 */
class AuditObserver
{
    /** Fields stripped from old/new values before persisting. */
    protected const HIDDEN_FIELDS = ['password', 'remember_token', 'password_confirmation'];

    public function created(Model $model): void
    {
        $this->record($model, 'created', [], $this->visibleChanges($model->getAttributes()));
    }

    public function updated(Model $model): void
    {
        $changes = $model->getChanges();
        if (empty($changes)) {
            return;
        }
        $old = [];
        foreach (array_keys($changes) as $key) {
            $old[$key] = $model->getOriginal($key);
        }
        $this->record($model, 'updated', $this->visibleChanges($old), $this->visibleChanges($changes));
    }

    public function deleted(Model $model): void
    {
        $this->record($model, 'deleted', $this->visibleChanges($model->getAttributes()), []);
    }

    /**
     * Persist one audit row.
     */
    protected function record(Model $model, string $event, array $old, array $new): void
    {
        Audit::create([
            'auditable_type' => get_class($model),
            'auditable_id' => $model->getKey(),
            'event' => $event,
            'user_id' => Auth::id(),
            'old_values' => $old,
            'new_values' => $new,
            'url' => request()->fullUrl() ?? null,
            'ip_address' => request()->ip() ?? null,
            'user_agent' => request()->userAgent() ?? null,
            'tags' => null,
        ]);
    }

    /**
     * Strip hidden/sensitive fields from a value map.
     */
    protected function visibleChanges(array $values): array
    {
        return array_diff_key($values, array_flip(self::HIDDEN_FIELDS));
    }
}
