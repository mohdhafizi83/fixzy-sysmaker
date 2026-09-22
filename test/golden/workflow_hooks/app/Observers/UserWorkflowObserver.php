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
            $__wf_tgChat = $telegram_chat_id;
            if ($__wf_tgChat === '') { $__wf_tgChat = \App\Models\FixzySetting::get('telegram_default_chat_id', ''); }
            $__wf_tgToken = \App\Models\FixzySetting::get('telegram_bot_token', '');
            if ($__wf_tgChat !== '' && $__wf_tgToken !== '') {
                \Illuminate\Support\Facades\Http::timeout(15)->asJson()->post(
                    'https://api.telegram.org/bot' . $__wf_tgToken . '/sendMessage',
                    ['chat_id' => $__wf_tgChat, 'text' => 'New user ' . $user_name . ' registered!']
                );
            }
        } else {
            return;
        }
    }
}
