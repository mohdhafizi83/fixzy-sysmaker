<?php

namespace App\Filament\Widgets;

/**
 * Report widget "Qty vs Price (Combo)" (Fixzy SysMaker generated code).
 * Compiled from the Dashboard Builder — edit in Fixzy SysMaker, not here.
 */
class Report_w10 extends BaseReportChart
{
    /** @var array<string, mixed> */
    protected static array $cfg = [
        'id' => "w10",
        'title' => "Qty vs Price (Combo)",
        'type' => "chart_combo",
        'table' => "inventori",
        'model' => "App\\Models\\Inventori",
        'width' => "full",
        'color' => "danger",
        'icon' => "",
        'aggregate' => "sum",
        'label_field' => "item_name",
        'value_field' => "kuantiti",
        'series_field' => "harga_seunit",
        'size_field' => "",
        'series_aggregate' => "avg",
        'filter_field' => "",
        'filter_operator' => "",
        'filter_value' => "",
        'timeframe' => "all",
        'refresh_mode' => "static",
        'refresh_interval' => "10",
        'advanced' => null,
    ];

}
