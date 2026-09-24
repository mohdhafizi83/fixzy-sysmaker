<?php

namespace App\Filament\Widgets;

/**
 * Report widget "Latest Stock" (Fixzy SysMaker generated code).
 * Compiled from the Dashboard Builder — edit in Fixzy SysMaker, not here.
 */
class Report_w4 extends BaseReportTable
{
    /** @var array<string, mixed> */
    protected static array $cfg = [
        'id' => "w4",
        'title' => "Latest Stock",
        'type' => "table_latest",
        'table' => "inventori",
        'model' => "App\\Models\\Inventori",
        'width' => "full",
        'color' => "gray",
        'icon' => "",
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
