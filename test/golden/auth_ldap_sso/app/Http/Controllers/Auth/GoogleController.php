<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\FixzySetting;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

/**
 * Google single sign-on (Fixzy SysMaker generated — enabled by project
 * flag module_auth_google_sso). Powered by laravel/socialite.
 *
 * Credentials are read at runtime from the fixzy_settings table
 * (editable on the Auth Settings page) with an env fallback, so keys
 * are never baked into the code.
 */
class GoogleController extends Controller
{
    public function redirect(): \Symfony\Component\HttpFoundation\Response
    {
        $this->assertConfigured();

        return Socialite::driver('google')->redirect();
    }

    public function callback(): \Illuminate\Http\RedirectResponse
    {
        $this->assertConfigured();

        $googleUser = Socialite::driver('google')->user();

        $user = User::query()
            ->where('google_id', $googleUser->getId())
            ->orWhere('email', $googleUser->getEmail())
            ->first();

        if (! $user) {
            // Auto-provision the account on first Google sign-in.
            $user = User::create([
                'name' => $googleUser->getName() ?: $googleUser->getEmail(),
                'email' => $googleUser->getEmail(),
                'google_id' => $googleUser->getId(),
                'password' => bcrypt(bin2hex(random_bytes(16))),
            ]);
        } elseif (empty($user->google_id)) {
            $user->forceFill(['google_id' => $googleUser->getId()])->save();
        }

        Auth::login($user, remember: true);

        session()->regenerate();

        return redirect()->intended('/admin');
    }

    protected function assertConfigured(): void
    {
        if (! $this->clientId()) {
            abort(503, 'Google sign-in is not configured yet. Open the Auth Settings page in the admin panel and add your Google OAuth credentials.');
        }
    }

    public static function clientId(): ?string
    {
        return FixzySetting::get('google_client_id', env('GOOGLE_CLIENT_ID'));
    }

    public static function clientSecret(): ?string
    {
        return FixzySetting::get('google_client_secret', env('GOOGLE_CLIENT_SECRET'));
    }

    public static function redirectUri(): string
    {
        return FixzySetting::get('google_redirect_uri', rtrim(config('app.url'), '/') . '/auth/google/callback');
    }
}
