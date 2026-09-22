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
        switch ($role) {
            case 'admin':
                // admin path
                break;
            case 'lecturer':
                // lecturer path
                break;
            default:
                // default path
        }
    }
}
