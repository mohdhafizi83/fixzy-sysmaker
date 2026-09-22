<?php

namespace App\Listeners;

/**
 * Project-level workflow listener (Fixzy SysMaker generated).
 */
class ProjectWorkflowListener
{
    public function afterLogin($event): void
    {
        $record = $event->user ?? $event;
        $login_time = now();
        // user logged in at $login_time
    }
}
