<?php

namespace App\Filament\Pages;

use Filament\Pages\Dashboard;

/**
 * Custom dashboard (Fixzy SysMaker generated code).
 *
 * Renders the report widgets configured in the Dashboard Builder.
 * Each widget is a generated subclass with its compiled config —
 * see App\Filament\Widgets\Report*.
 */
class FixzyDashboard extends Dashboard
{
    protected static ?string $title = 'Dashboard';

    /**
     * @return array<class-string<\Filament\Widgets\Widget>>
     */
    public function getWidgets(): array
    {
        return [
            \App\Filament\Widgets\Report_w1::class,
            \App\Filament\Widgets\Report_w2::class,
            \App\Filament\Widgets\Report_w3::class,
            \App\Filament\Widgets\Report_w4::class,
        ];
    }

    /**
     * @return int | array<string, ?int>
     */
    public function getColumns(): int | array
    {
        return 2;
    }
}
