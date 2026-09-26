<?php

namespace App\Filament\Widgets;

/**
 * Report widget "Monthly Stock (Line)" (Fixzy SysMaker generated code).
 * Compiled from the Dashboard Builder — edit in Fixzy SysMaker, not here.
 */
class Report_w8 extends BaseReportChart
{
    /** @var array<string, mixed> */
    protected static array $cfg = [
        'id' => "w8",
        'title' => "Monthly Stock (Line)",
        'type' => "chart_line",
        'table' => "inventori",
        'model' => "App\\Models\\Inventori",
        'width' => "2",
        'color' => "primary",
        'icon' => "",
        'aggregate' => "sum",
        'label_field' => "item_name",
        'value_field' => "kuantiti",
        'series_field' => "",
        'size_field' => "",
        'series_aggregate' => "sum",
        'filter_field' => "",
        'filter_operator' => "",
        'filter_value' => "",
        'timeframe' => "this_year",
        'refresh_mode' => "poll",
        'refresh_interval' => "30",
        'advanced' => null,
    ];

}
