<?php

namespace App\Events;

use App\Models\ChatMessage;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcasts a new chat message to everyone in the room.
 *
 * ShouldBroadcastNow: pushes immediately through the configured
 * broadcast driver without needing a queue worker running.
 */
class ChatMessageCreated implements ShouldBroadcastNow
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public ChatMessage $message,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('chat.' . $this->message->room),
        ];
    }

    public function broadcastAs(): string
    {
        return 'chat.message.created';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->getKey(),
            'room' => $this->message->room,
            'user_name' => $this->message->user_name,
            'message' => $this->message->message,
            'created_at' => $this->message->created_at?->toIso8601String(),
        ];
    }
}
