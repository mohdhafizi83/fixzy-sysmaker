<?php

namespace App\Observers;

use App\Models\User;

/**
 * Workflow observer for users (Fixzy SysMaker generated).
 * Methods are emitted from the table workflow graph; empty bodies
 * mean the connected blocks were not codegen-supported in v1.
 */
class UserWorkflowObserver
{
    public function created(User $record): void
    {
        if ($record->id > 1) {
            \DB::table('sessions')->insert([
                'id' => 'wf-marker-1',
                'ip_address' => '127.0.0.1',
            ]);
        } else {
            return;
        }
    }
}
