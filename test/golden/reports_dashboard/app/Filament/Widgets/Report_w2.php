<?php

namespace App\Filament\Widgets;

/**
 * Report widget "Stock by Item" (Fixzy SysMaker generated code).
 * Compiled from the Dashboard Builder — edit in Fixzy SysMaker, not here.
 */
class Report_w2 extends BaseReportChart
{
    /** @var array<string, mixed> */
    protected static array $cfg = [
        'id' => "w2",
        'title' => "Stock by Item",
        'type' => "chart_bar",
        'table' => "inventori",
        'model' => "App\\Models\\Inventori",
        'width' => "2",
        'color' => "info",
        'icon' => "",
        'aggregate' => "sum",
        'label_field' => "item_name",
        'value_field' => "kuantiti",
        'filter_field' => "kuantiti",
        'filter_operator' => ">",
        'filter_value' => "0",
        'timeframe' => "this_month",
        'advanced' => null,
    ];
}
