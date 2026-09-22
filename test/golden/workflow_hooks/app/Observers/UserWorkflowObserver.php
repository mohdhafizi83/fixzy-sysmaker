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
            $__wf_to = $user_email;
            $__wf_subject = 'Welcome ' . $user_name . ' (id ' . $order_id . ')';
            $__wf_body = 'Hello ' . $user_name . ', your account was created.';
            if (!empty($__wf_to)) {
                \Illuminate\Support\Facades\Mail::raw($__wf_body, function ($msg) use ($__wf_to, $__wf_subject) {
                    $msg->to($__wf_to);
                    $msg->cc('admin@example.com');
                    $msg->subject($__wf_subject);
                });
            }
        } else {
            return;
        }
    }
}
