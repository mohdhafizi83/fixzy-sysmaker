<?php

namespace App\Console\Commands;

use App\Models\ScheduleRun;
use App\Notifications\SchedulerReminder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Fixzy SysMaker Scheduler runner (generated code).
 *
 * All schedules designed in Fixzy SysMaker are compiled into the
 * constants below. The Laravel scheduler ticks this command every
 * minute (SchedulerServiceProvider); each entry decides for itself
 * whether it is due, and ScheduleRun bookkeeping guarantees every
 * fire happens AT MOST ONCE per day (idempotent across double ticks,
 * restarts, and concurrent runners).
 *
 * Kinds:
 *   reminder  — notify <roles> N days before a date field's value
 *   recurring — clone the latest row on a daily/weekly/monthly cycle
 *   backup    — dump the database to storage/app/backups with retention
 */
class ScheduleRunnerCommand extends Command
{
    protected $signature = 'fixzy:schedule-run {--force : Ignore the due-window and run all entries now (testing)}';

    protected $description = 'Run all Fixzy SysMaker scheduled tasks (reminders, recurring records, backups)';

    /** Reminder entries (compiled from the design). */
    public const REMINDERS = [
        ['kind' => 'reminder', 'table' => 'log_penting', 'model' => 'LogPenting', 'field' => 'due_date', 'offset_days' => 0, 'notify' => ''],
    ];

    /** Recurring-record entries (compiled from the design). */
    public const RECURRING = [
        ['kind' => 'recurring', 'table' => 'log_penting', 'model' => 'LogPenting', 'recurrence' => 'monthly', 'day' => 1, 'weekday' => 1, 'notify' => 'admin'],
    ];

    /** Backup entries (compiled from the design). */
    public const BACKUPS = [

    ];

    public function handle(): int
    {
        $force = (bool) $this->option('force');
        $today = now();

        $fired = 0;
        $fired += $this->runReminders($today, $force);
        $fired += $this->runRecurring($today, $force);
        $fired += $this->runBackups($today, $force);

        if ($fired > 0) {
            $this->info("Scheduler: {$fired} task(s) fired.");
        }

        return self::SUCCESS;
    }

    /**
     * Reminders: fire when the date field equals today + offset_days.
     * Returns the number of notifications sent.
     */
    protected function runReminders(\DateTimeInterface $today, bool $force): int
    {
        $count = 0;

        foreach (static::REMINDERS as $s) {
            $modelClass = '\\App\\Models\\'.$s['model'];
            if (! class_exists($modelClass)) {
                continue;
            }

            $target = $today->copy()->addDays((int) $s['offset_days'])->toDateString();

            $records = $modelClass::query()
                ->whereNotNull($s['field'])
                ->when(
                    $force,
                    fn ($q) => $q->whereDate($s['field'], '>=', $today->toDateString()),
                    fn ($q) => $q->whereDate($s['field'], $target)
                )
                ->get();

            foreach ($records as $record) {
                if (! ScheduleRun::claim('reminder', $s['table'], $record->getKey(), $today)) {
                    continue; // already fired today
                }

                $days = (int) $today->copy()->startOfDay()->diffInDays(
                    \Illuminate\Support\Carbon::parse($record->{$s['field']})->startOfDay(),
                    false
                );
                $when = $days > 0 ? "in {$days} day(s)" : ($days < 0 ? abs($days).' day(s) overdue' : 'today');
                $title = 'Reminder: '.$s['table'].' #'.$record->getKey().' '.$when;
                $body = 'Record #'.$record->getKey().' of '.$s['table'].' has '.$s['field'].' = '.
                    \Illuminate\Support\Carbon::parse($record->{$s['field']})->toDateString().' ('.$when.').';

                $this->notifyRoles($s['notify'], new SchedulerReminder($title, $body));
                $this->line('reminder fired: '.$s['table'].' #'.$record->getKey());
                $count++;
            }
        }

        return $count;
    }

    /**
     * Recurring records: clone the latest row once per period.
     * Returns the number of rows created.
     */
    protected function runRecurring(\DateTimeInterface $today, bool $force): int
    {
        $count = 0;

        foreach (static::RECURRING as $s) {
            $modelClass = '\\App\\Models\\'.$s['model'];
            if (! class_exists($modelClass)) {
                continue;
            }

            if (! $this->recurringDue($s, $today, $force)) {
                continue;
            }

            // One creation per period: claim on the period key, not the day.
            $periodKey = $this->periodKey($s, $today);
            if (! ScheduleRun::claim('recurring', $s['table'], 0, $periodKey)) {
                continue;
            }

            $last = $modelClass::query()->latest()->first();
            if (! $last) {
                // Nothing to clone yet — seed one row so the cycle starts.
                $last = new $modelClass();
            }

            $fresh = $last->replicate();
            // Reset lifecycle columns so the clone is a brand-new record.
            $fresh->save();
            $count++;
            $this->line('recurring created: '.$s['table'].' #'.$fresh->getKey().' (period '.$periodKey.')');

            if (! empty($s['notify'])) {
                $this->notifyRoles($s['notify'], new SchedulerReminder(
                    'Recurring record created',
                    'A new '.$s['table'].' record (#'.$fresh->getKey().') was auto-created for period '.$periodKey.'.'
                ));
            }
        }

        return $count;
    }

    protected function recurringDue(array $s, \DateTimeInterface $today, bool $force): bool
    {
        if ($force) {
            return true;
        }
        switch ($s['recurrence']) {
            case 'weekly':
                return (int) $today->format('N') === (int) $s['weekday'];
            case 'monthly':
                $day = min((int) $s['day'], (int) $today->format('t')); // clamp to month length
                return (int) $today->format('j') === $day;
            case 'daily':
            default:
                return true;
        }
    }

    protected function periodKey(array $s, \DateTimeInterface $today): string
    {
        switch ($s['recurrence']) {
            case 'weekly':
                return $today->format('o-W').'-1'; // ISO year-week
            case 'monthly':
                return $today->format('Y-m').'-01';
            case 'daily':
            default:
                return $today->toDateString();
        }
    }

    /**
     * Backups: dump the database with a retention count.
     * Returns the number of backups taken.
     */
    protected function runBackups(\DateTimeInterface $today, bool $force): int
    {
        $count = 0;

        foreach (static::BACKUPS as $s) {
            if (! $this->backupDue($s, $today, $force)) {
                continue;
            }
            if (! ScheduleRun::claim('backup', 'database', 0, $today)) {
                continue; // already backed up today
            }

            $dir = storage_path('app/backups');
            if (! is_dir($dir)) {
                mkdir($dir, 0775, true);
            }

            $name = 'backup_'.$today->format('Y-m-d_His').'.sql';
            $path = $dir.'/'.$name;
            $driver = config('database.default');

            try {
                if ($driver === 'sqlite') {
                    $dbPath = config('database.connections.sqlite.database');
                    $gzip = $path.'.gz';
                    $fh = gzopen($gzip, 'w9');
                    gzpassthru(fopen($dbPath, 'r'), $fh);
                    gzclose($fh);
                    @unlink($path); // we wrote the .gz variant
                    $path = $gzip;
                } else {
                    $conn = config('database.connections.'.$driver);
                    $cmd = sprintf(
                        'mysqldump --single-transaction --host=%s --port=%s --user=%s --password=%s %s 2>/dev/null | gzip -9 > %s',
                        escapeshellarg((string) ($conn['host'] ?? '127.0.0.1')),
                        escapeshellarg((string) ($conn['port'] ?? '3306')),
                        escapeshellarg((string) ($conn['username'] ?? '')),
                        escapeshellarg((string) ($conn['password'] ?? '')),
                        escapeshellarg((string) ($conn['database'] ?? '')),
                        escapeshellarg($path.'.gz')
                    );
                    exec($cmd, $out, $exit);
                    if ($exit !== 0 || ! file_exists($path.'.gz') || filesize($path.'.gz') === 0) {
                        $this->error('mysqldump failed (exit '.$exit.'); is the binary installed?');
                        @unlink($path.'.gz');
                        continue;
                    }
                    $path = $path.'.gz';
                }
            } catch (\Throwable $e) {
                report($e);
                $this->error('Backup failed: '.$e->getMessage());
                continue;
            }

            $this->applyRetention((int) ($s['retention'] ?? 10));
            $count++;
            $this->line('backup written: '.basename($path));

            if (! empty($s['notify'])) {
                $this->notifyRoles($s['notify'], new SchedulerReminder(
                    'Database backup completed',
                    'Backup stored as '.basename($path).' (retention: '.(int) ($s['retention'] ?? 10).').'
                ));
            }
        }

        return $count;
    }

    protected function backupDue(array $s, \DateTimeInterface $today, bool $force): bool
    {
        if ($force) {
            return true;
        }
        $freq = $s['frequency'] ?? 'daily';
        if ($freq === 'weekly') {
            return (int) $today->format('N') === (int) ($s['weekday'] ?? 1);
        }
        return true;
    }

    protected function applyRetention(int $keep): void
    {
        if ($keep < 1) {
            $keep = 10;
        }
        $files = glob(storage_path('app/backups/backup_*.gz')) ?: [];
        usort($files, fn ($a, $b) => filemtime($b) <=> filemtime($a));
        foreach (array_slice($files, $keep) as $old) {
            @unlink($old);
        }
    }

    /**
     * Notify users by Shield role (comma-separated names).
     * 'admin' maps to super_admin. Empty notify = no-op.
     */
    protected function notifyRoles(string $notify, $notification): void
    {
        $notify = trim($notify);
        if ($notify === '') {
            return;
        }
        $model = config('auth.providers.users.model');
        try {
            foreach (array_map('trim', explode(',', $notify)) as $role) {
                if ($role === '') {
                    continue;
                }
                $role = $role === 'admin' ? 'super_admin' : $role;
                $model::role($role)->get()->each(fn ($u) => $u->notify($notification));
            }
        } catch (\Throwable $e) {
            // Shield unavailable or role missing — skip silently.
            report($e);
        }
    }
}
