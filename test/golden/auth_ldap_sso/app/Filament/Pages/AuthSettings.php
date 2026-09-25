<?php

namespace App\Filament\Pages;

use App\Models\FixzySetting;
use Filament\Pages\Page;

/**
 * Auth integration settings (Fixzy SysMaker generated).
 *
 * The admin pastes Google OAuth / LDAP credentials here once. Values
 * are stored in the fixzy_settings table and read at runtime — they
 * are never committed to code.
 */
class AuthSettings extends Page
{
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-key';

    protected static ?string $navigationLabel = 'Auth Settings';

    protected static ?string $title = 'Single Sign-On & Directory Settings';

    protected static ?string $slug = 'auth-settings';

    protected string $view = 'filament.pages.auth-settings';

    protected static ?int $navigationSort = 998;

    protected static string | \UnitEnum | null $navigationGroup = 'System';

    public array $settings = [];

    public function mount(): void
    {
        $this->settings = [
            'google_client_id' => FixzySetting::get('google_client_id', ''),
            'google_client_secret' => FixzySetting::get('google_client_secret', ''),
            'google_redirect_uri' => FixzySetting::get('google_redirect_uri', rtrim(config('app.url'), '/') . '/auth/google/callback'),
            
            'ldap_hosts' => FixzySetting::get('ldap_hosts', ''),
            'ldap_port' => FixzySetting::get('ldap_port', '389'),
            'ldap_base_dn' => FixzySetting::get('ldap_base_dn', ''),
            'ldap_bind_dn' => FixzySetting::get('ldap_bind_dn', ''),
            'ldap_bind_password' => FixzySetting::get('ldap_bind_password', ''),
            'ldap_username_field' => FixzySetting::get('ldap_username_field', 'uid'),
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

        session()->flash('fixzy_settings_saved', 'Auth settings saved.');
    }
}
