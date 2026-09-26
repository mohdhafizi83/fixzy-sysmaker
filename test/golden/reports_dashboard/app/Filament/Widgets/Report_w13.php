<?php

namespace App\Filament\Widgets;

/**
 * Report widget "Bubble Qty/Price/Value" (Fixzy SysMaker generated code).
 * Compiled from the Dashboard Builder — edit in Fixzy SysMaker, not here.
 */
class Report_w13 extends BaseReportChart
{
    /** @var array<string, mixed> */
    protected static array $cfg = [
        'id' => "w13",
        'title' => "Bubble Qty/Price/Value",
        'type' => "chart_bubble",
        'table' => "inventori",
        'model' => "App\\Models\\Inventori",
        'width' => "1",
        'color' => "warning",
        'icon' => "",
        'aggregate' => "count",
        'label_field' => "",
        'value_field' => "kuantiti",
        'series_field' => "harga_seunit",
        'size_field' => "id",
        'series_aggregate' => "sum",
        'filter_field' => "",
        'filter_operator' => "",
        'filter_value' => "",
        'timeframe' => "all",
        'refresh_mode' => "static",
        'refresh_interval' => "10",
        'advanced' => null,
    ];

}
