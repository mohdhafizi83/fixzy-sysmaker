<?php

namespace App\Observers;

use App\Events\DataChanged;
use Illuminate\Database\Eloquent\Model;

/**
 * Broadcasts DataChanged when a live-widget source table changes
 * (Fixzy SysMaker generated code).
 *
 * Debounce: at most one broadcast per table per 2 seconds per PHP
 * process — a bulk import of 1000 rows triggers one refresh wave,
 * not 1000. Different FPM workers may each emit once per window;
 * widget-side handlers are idempotent (they just re-query).
 */
class FixzyLiveObserver
{
    /** @var array<string, int> last broadcast epoch per table */
    protected static array $last = [];

    protected const DEBOUNCE_SECONDS = 2;

    public function created(Model $model): void
    {
        $this->fire($model);
    }

    public function updated(Model $model): void
    {
        $this->fire($model);
    }

    public function deleted(Model $model): void
    {
        $this->fire($model);
    }

    protected function fire(Model $model): void
    {
        $table = $model->getTable();
        $now = time();
        if (isset(self::$last[$table]) && ($now - self::$last[$table]) < self::DEBOUNCE_SECONDS) {
            return;
        }
        self::$last[$table] = $now;
        event(new DataChanged($table));
    }
}
