<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schedule;

/**
 * Registers Fixzy SysMaker generated workflow hooks.
 */
class WorkflowServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        \App\Models\User::observe(\App\Observers\UserWorkflowObserver::class);
        Event::listen(Illuminate\Auth\Events\Login::class, \App\Listeners\ProjectWorkflowListener::class . '@afterLogin');
        Schedule::command('fixzy:scheduled-workflow')->everyMinute();
    }
}
