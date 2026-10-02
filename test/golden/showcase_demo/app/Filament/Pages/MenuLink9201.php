<?php

namespace App\Filament\Pages;

use Filament\Pages\Page;

/**
 * Custom menu link (Fixzy SysMaker generated code).
 *
 * Menu Management custom item "Reports Portal" -> /reports
 * Navigation links straight to the configured URL.
 */
class MenuLink9201 extends Page
{
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-link';

    protected static ?string $navigationLabel = 'Reports Portal';

    protected static ?int $navigationSort = 0;

    // The menu entry links straight out to the configured URL.
    protected static bool $shouldRegisterNavigation = true;

    protected string $view = 'filament.pages.menu-link';

    public static function getNavigationUrl(): string
    {
        return '/reports';
    }

    public static function getNavigationBadge(): ?string
    {
        return null;
    }
}
