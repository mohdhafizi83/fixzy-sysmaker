<?php

namespace App\Filament\Pages;

use Filament\Pages\Page;

/**
 * Homepage card grid (Fixzy SysMaker generated code).
 *
 * Driven by Menu Management: tables per row (4), panel height
 * (100px), first card extra wide (yes).
 * The panel's home URL points here when "Menu at Homepage" is enabled.
 */
class FixzyHomepage extends Page
{
    protected static ?string $slug = 'home';

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-home';

    protected static ?string $navigationLabel = 'Home';

    protected static ?string $title = 'Home';

    // The homepage is the landing page, not a menu entry.
    protected static bool $shouldRegisterNavigation = false;

    protected string $view = 'filament.pages.homepage';
}
