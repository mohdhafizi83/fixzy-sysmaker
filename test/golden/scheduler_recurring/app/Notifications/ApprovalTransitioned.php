<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Sent when a record moves through the approval workflow.
 * Delivered to the database channel (live bell when the realtime module
 * is on) and by mail when the user has an address.
 */
class ApprovalTransitioned extends Notification
{
    use Queueable;

    public function __construct(
        public string $title,
        public string $from,
        public string $to,
        public int|string $recordId,
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
            ->line('Record #'.$this->recordId.' was updated in the approval workflow.');
    }

    public function toArray($notifiable): array
    {
        return [
            'title' => $this->title,
            'body' => 'Record #'.$this->recordId.': '.ucfirst(str_replace('_', ' ', $this->from)).' → '.ucfirst(str_replace('_', ' ', $this->to)),
            'icon' => 'heroicon-o-clipboard-document-check',
            'iconColor' => 'info',
        ];
    }
}
