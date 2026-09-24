<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Scheduler fire-once bookkeeping (Fixzy SysMaker Scheduler module).
 *
 * One row per (kind, table, record, fire_date). The ScheduleRunner
 * command inserts here BEFORE notifying, and the unique index makes a
 * second run on the same day a no-op — reminders never double-fire
 * even if the cron tick runs twice.
 */
class ScheduleRun extends Model
{
    protected $fillable = [
        'kind',
        'table_name',
        'record_id',
        'fire_date',
    ];

    protected $casts = [
        'fire_date' => 'date',
    ];

    /** Has this (kind, table, record) already fired on the given date? */
    public static function alreadyFired(string $kind, string $table, int|string $recordId, $date): bool
    {
        return static::query()
            ->where('kind', $kind)
            ->where('table_name', $table)
            ->where('record_id', $recordId)
            ->whereDate('fire_date', $date)
            ->exists();
    }

    /** Claim the fire slot. Returns true when this caller won the race. */
    public static function claim(string $kind, string $table, int|string $recordId, $date): bool
    {
        try {
            static::query()->insert([
                'kind' => $kind,
                'table_name' => $table,
                'record_id' => $recordId,
                'fire_date' => $date instanceof \DateTimeInterface ? $date->format('Y-m-d') : $date,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return true;
        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
            return false;
        } catch (\Illuminate\Database\QueryException $e) {
            // SQLSTATE 23000 = integrity constraint violation (covers
            // drivers without the dedicated exception class).
            if ((string) $e->getCode() === '23000') {
                return false;
            }

            throw $e;
        }
    }
}
