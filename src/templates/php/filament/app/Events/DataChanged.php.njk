<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Broadcasts a data change on one table so live dashboard widgets can
 * refresh without polling (Fixzy SysMaker generated code).
 *
 * ShouldBroadcastNow: pushes immediately without a queue worker.
 * Channel: fixzy.data.{table} (authenticated users only).
 */
class DataChanged implements ShouldBroadcastNow
{
    use Dispatchable;

    public function __construct(
        public string $table,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('fixzy.data.' . $this->table),
        ];
    }

    public function broadcastAs(): string
    {
        return 'fixzy.data.changed';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'table' => $this->table,
            'at' => now()->toIso8601String(),
        ];
    }
}
