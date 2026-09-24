<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Forces JSON content negotiation on the generated REST API
 * (Fixzy SysMaker). Ensures auth failures answer 401 JSON instead
 * of redirecting to a login route that may not exist.
 */
class ApiJsonRequest
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->is('api/*')) {
            $request->headers->set('Accept', 'application/json');
        }

        return $next($request);
    }
}
