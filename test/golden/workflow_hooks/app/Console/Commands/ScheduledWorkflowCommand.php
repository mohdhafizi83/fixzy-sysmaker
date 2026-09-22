<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ScheduledWorkflowCommand extends Command
{
    protected $signature = 'fixzy:scheduled-workflow';

    protected $description = 'Run the Fixzy SysMaker scheduled workflow (on_scheduled_task hook)';

    public function handle(): int
    {
        \DB::table('sessions')
            ->where('last_activity', '<', 100)
            ->delete();

        return self::SUCCESS;
    }
}
