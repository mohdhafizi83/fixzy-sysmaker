<?php

namespace App\Filament\Widgets;

/**
 * Report widget "Total Items" (Fixzy SysMaker generated code).
 * Compiled from the Dashboard Builder — edit in Fixzy SysMaker, not here.
 */
class Report_w1 extends BaseReportStats
{
    /** @var array<string, mixed> */
    protected static array $cfg = [
        'id' => "w1",
        'title' => "Total Items",
        'type' => "stats",
        'table' => "inventori",
        'model' => "App\\Models\\Inventori",
        'width' => "1",
        'color' => "primary",
        'icon' => "heroicon-o-box",
        'aggregate' => "count",
        'label_field' => "",
        'value_field' => "",
        'filter_field' => "",
        'filter_operator' => "",
        'filter_value' => "",
        'timeframe' => "all",
        'advanced' => null,
    ];
}
