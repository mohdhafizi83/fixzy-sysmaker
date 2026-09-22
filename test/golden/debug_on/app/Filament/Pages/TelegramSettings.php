<?php

namespace App\Filament\Pages;

use App\Models\FixzySetting;
use Filament\Pages\Page;

/**
 * Telegram bot settings (Fixzy SysMaker generated).
 *
 * The admin pastes the bot token created via @BotFather once. Workflow
 * "Send Telegram" actions read the token from here at runtime, so the
 * secret never lives in code or .env.
 */
class TelegramSettings extends Page
{
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-paper-airplane';

    protected static ?string $navigationLabel = 'Telegram Bot';

    protected static ?string $title = 'Telegram Bot Settings';

    protected static ?string $slug = 'telegram-settings';

    protected string $view = 'filament.pages.telegram-settings';

    protected static ?int $navigationSort = 996;

    protected static string | \UnitEnum | null $navigationGroup = 'System';

    public array $settings = [];

    public function mount(): void
    {
        $this->settings = [
            'telegram_bot_token' => FixzySetting::get('telegram_bot_token', ''),
            'telegram_default_chat_id' => FixzySetting::get('telegram_default_chat_id', ''),
        ];
    }

    public function save(): void
    {
        $allowed = array_keys($this->settings);

        foreach ($allowed as $key) {
            $value = $this->settings[$key] ?? null;
            if ($value !== null && $value !== '') {
                FixzySetting::set($key, $value);
            }
        }

        session()->flash('fixzy_settings_saved', 'Telegram settings saved. Workflow "Send Telegram" actions now use this bot.');
    }

    public function testSend(): void
    {
        $token = $this->settings['telegram_bot_token'] ?? '';
        $chatId = $this->settings['telegram_default_chat_id'] ?? '';

        if ($token === '' || $chatId === '') {
            session()->flash('fixzy_settings_error', 'Fill in the bot token and a default chat ID first.');
            return;
        }

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(15)->asJson()->post(
                'https://api.telegram.org/bot' . $token . '/sendMessage',
                [
                    'chat_id' => $chatId,
                    'text' => 'Test message from your Fixzy SysMaker generated app. Your Telegram bot works!',
                ]
            );

            if ($response->successful() && ($response->json('ok') ?? false)) {
                session()->flash('fixzy_settings_saved', 'Test message sent to chat ' . $chatId . '.');
            } else {
                session()->flash('fixzy_settings_error', 'Telegram rejected the request: ' . ($response->json('description') ?? ('HTTP ' . $response->status())));
            }
        } catch (\Throwable $e) {
            session()->flash('fixzy_settings_error', 'Send failed: ' . $e->getMessage());
        }
    }
}
