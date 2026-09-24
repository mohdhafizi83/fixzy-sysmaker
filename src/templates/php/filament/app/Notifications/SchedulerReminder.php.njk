<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Scheduler reminder notification (Fixzy SysMaker Scheduler module).
 * Delivered to the database channel (live bell when the realtime module
 * is on) and by mail when the user has an address.
 */
class SchedulerReminder extends Notification
{
    use Queueable;

    public function __construct(
        public string $title,
        public string $body,
    ) {}

    public function via($notifiable): array
    {
        $channels = ['database'];
        if (! empty($notifiable->email)) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toMail($notifiable): \Illuminate\Notifications\Messages\MailMessage
    {
        return (new \Illuminate\Notifications\Messages\MailMessage)
            ->subject($this->title)
            ->line($this->title)
            ->line($this->body);
    }

    public function toArray($notifiable): array
    {
        return [
            'title' => $this->title,
            'body' => $this->body,
            'icon' => 'heroicon-o-bell-alert',
            'iconColor' => 'warning',
        ];
    }
}
