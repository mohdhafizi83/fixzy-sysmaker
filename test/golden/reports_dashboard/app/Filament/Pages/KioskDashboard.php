<?php

namespace App\Filament\Pages;

use Filament\Pages\Dashboard;

/**
 * Kiosk display mode (Fixzy SysMaker generated code).
 *
 * Wall/TV presentation of the same Dashboard Builder widgets:
 * auto-rotating pages, big-type stats, live clock. Opens at /kiosk
 * (hidden from navigation). Pair with live-mode widgets for real-time
 * wallboards; poll/static widgets rotate too.
 */
class KioskDashboard extends Dashboard
{
    protected static string $routePath = 'kiosk';

    protected static ?string $title = 'Kiosk Display';

    public static function shouldRegisterNavigation(): bool
    {
        return false;
    }

    protected string $view = 'filament.pages.kiosk';
}
