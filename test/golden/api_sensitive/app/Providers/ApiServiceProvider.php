<?php

namespace App\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/**
 * REST API module routes (Fixzy SysMaker generated code).
 *
 * Token-authenticated JSON API under /api/v1. Auth is Laravel
 * Sanctum (bearer token); role checks + field allowlists are
 * enforced per-table inside the controller using the generated
 * ApiRegistry.
 */
class ApiServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // ApiJsonRequest runs BEFORE auth:sanctum so unauthenticated
        // calls answer 401 JSON, never a redirect to a login route.
        Route::middleware([\App\Http\Middleware\ApiJsonRequest::class, 'auth:sanctum'])
            ->prefix('api/v1')
            ->name('api.v1.')
            ->group(function (): void {
                Route::get('/{slug}', [\App\Http\Controllers\Api\ApiController::class, 'index'])->name('index');
                Route::post('/{slug}', [\App\Http\Controllers\Api\ApiController::class, 'store'])->name('store');
                Route::get('/{slug}/{id}', [\App\Http\Controllers\Api\ApiController::class, 'show'])->name('show');
                Route::put('/{slug}/{id}', [\App\Http\Controllers\Api\ApiController::class, 'update'])->name('update');
            });
    }
}
