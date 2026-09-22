<?php

namespace App\Filament\Auth;

use Filament\Auth\Pages\Login;
use Filament\Schemas\Schema;
use Filament\Forms\Components\TextInput;

/**
 * Login page with a built-in human check (Fixzy SysMaker generated —
 * enabled by project flag module_auth_email_captcha).
 *
 * Native implementation: a simple arithmetic challenge stored in the
 * session. No third-party captcha service, no external network calls.
 */
class CaptchaLogin extends Login
{
    public function form(Schema $schema): Schema
    {
        $captcha = session()->get('fixzy_captcha');
        if (!is_array($captcha) || count($captcha) !== 2) {
            $captcha = [random_int(1, 9), random_int(1, 9)];
            session(['fixzy_captcha' => $captcha]);
        }

        return $schema
            ->components([
                $this->getEmailFormComponent(),
                $this->getPasswordFormComponent(),
                $this->getRememberFormComponent(),
                TextInput::make('captcha')
                    ->label("Human check: what is {$captcha[0]} + {$captcha[1]}?")
                    ->numeric()
                    ->required()
                    ->rule(function (string $attribute, $value): bool {
                        $c = session('fixzy_captcha');
                        return is_array($c) && (int) $value === ((int) $c[0] + (int) $c[1]);
                    }, 'Incorrect answer — please try again.'),
            ]);
    }
}
