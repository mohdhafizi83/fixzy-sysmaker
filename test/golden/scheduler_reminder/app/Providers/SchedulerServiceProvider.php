<?php

namespace App\Providers;

use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\ServiceProvider;

/**
 * Fixzy SysMaker Scheduler module registration (generated code).
 *
 * ONE cron entry drives every schedule: the runner ticks every minute
 * and each compiled schedule decides whether it is due. This keeps the
 * host crontab tiny regardless of how many schedules the app has:
 *
 *   * * * * * cd /path/to/app && php artisan schedule:run >> /dev/null 2>&1
 *
 * (schedule:run is Laravel's own scheduler daemon — it dispatches the
 * command below on its everyMinute cadence.)
 */
class SchedulerServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Guard: the runner command only exists when the module is on.
        if (! class_exists(\App\Console\Commands\ScheduleRunnerCommand::class)) {
            return;
        }

        Schedule::command('fixzy:schedule-run')->everyMinute()->withoutOverlapping();
    }
}
