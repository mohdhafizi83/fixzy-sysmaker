<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;

/**
 * Locale switcher middleware (Fixzy SysMaker generated code).
 *
 * Reads the user's chosen locale from the session (set via the
 * language switcher in the user menu) and applies it to the whole
 * request. Falls back to the project default.
 */
class SetLocale
{
    public function handle(Request $request, Closure $next)
    {
        $supported = ['en', 'ms'];
        $locale = $request->session()->get('fixzy_locale', 'ms');
        if (! in_array($locale, $supported, true)) {
            $locale = 'ms';
        }
        App::setLocale($locale);

        return $next($request);
    }
}
