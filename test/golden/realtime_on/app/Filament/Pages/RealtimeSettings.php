<?php

namespace App\Filament\Pages;

use App\Models\FixzySetting;
use Filament\Pages\Page;

/**
 * Real-time / broadcasting settings (Fixzy SysMaker generated).
 *
 * The admin pastes the WebSocket credentials here once (Reverb app
 * key/secret, or Pusher app credentials). Values are stored in the
 * fixzy_settings table and applied to Laravel's broadcasting config at
 * boot by the RealtimeServiceProvider — secrets never live in code.
 */
class RealtimeSettings extends Page
{
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-signal';

    protected static ?string $navigationLabel = 'Real-time';

    protected static ?string $title = 'Real-time Broadcast Settings';

    protected static ?string $slug = 'realtime-settings';

    protected string $view = 'filament.pages.realtime-settings';

    protected static ?int $navigationSort = 995;

    protected static string | \UnitEnum | null $navigationGroup = 'System';

    public array $settings = [];

    public function mount(): void
    {
        $this->settings = [
            'realtime_backend' => FixzySetting::get('realtime_backend', 'reverb'),
            'broadcast_app_id' => FixzySetting::get('broadcast_app_id', ''),
            'broadcast_key' => FixzySetting::get('broadcast_key', ''),
            'broadcast_secret' => FixzySetting::get('broadcast_secret', ''),
            'broadcast_host' => FixzySetting::get('broadcast_host', 'localhost'),
            'broadcast_port' => FixzySetting::get('broadcast_port', '8080'),
            'broadcast_scheme' => FixzySetting::get('broadcast_scheme', 'http'),
        ];
    }

    /**
     * Whitelist of setting keys this page may write. Hardcoded server-side
     * — never derived from client-supplied state (Livewire hydrates
     * $settings from the browser).
     */
    private const ALLOWED_KEYS = [
        'realtime_backend',
        'broadcast_app_id',
        'broadcast_key',
        'broadcast_secret',
        'broadcast_host',
        'broadcast_port',
        'broadcast_scheme',
    ];

    public function save(): void
    {
        foreach (self::ALLOWED_KEYS as $key) {
            $value = $this->settings[$key] ?? null;
            if ($value !== null && $value !== '') {
                FixzySetting::set($key, $value);
            }
        }

        session()->flash('fixzy_settings_saved', 'Real-time settings saved. Restart the WebSocket server (php artisan reverb:start) if you changed Reverb keys.');
    }
}
