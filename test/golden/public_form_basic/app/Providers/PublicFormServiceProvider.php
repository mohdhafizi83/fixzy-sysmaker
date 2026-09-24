<?php

namespace App\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/**
 * Public intake form routes (Fixzy SysMaker generated code).
 *
 * Standalone public routes under /f/{slug} — deliberately OUTSIDE the
 * Filament admin panel. CSRF + session come from the `web` middleware;
 * throttling is enforced inside the controller.
 */
class PublicFormServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Route::middleware('web')
            ->prefix('f')
            ->name('public.form.')
            ->group(function (): void {
                Route::get('/{slug}', [\App\Http\Controllers\PublicFormController::class, 'show'])
                    ->name('show');
                Route::post('/{slug}', [\App\Http\Controllers\PublicFormController::class, 'submit'])
                    ->name('submit');
                Route::get('/{slug}/success', [\App\Http\Controllers\PublicFormController::class, 'success'])
                    ->name('success');
                Route::get('/{slug}/status', [\App\Http\Controllers\PublicFormController::class, 'lookupForm'])
                    ->name('lookup');
                Route::post('/{slug}/status', [\App\Http\Controllers\PublicFormController::class, 'lookup'])
                    ->name('lookup.check');
            });
    }
}
