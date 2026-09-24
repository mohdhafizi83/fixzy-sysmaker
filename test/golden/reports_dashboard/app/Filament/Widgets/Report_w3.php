<?php

namespace App\Filament\Widgets;

/**
 * Report widget "Avg Price by Item" (Fixzy SysMaker generated code).
 * Compiled from the Dashboard Builder — edit in Fixzy SysMaker, not here.
 */
class Report_w3 extends BaseReportChart
{
    /** @var array<string, mixed> */
    protected static array $cfg = [
        'id' => "w3",
        'title' => "Avg Price by Item",
        'type' => "chart_pie",
        'table' => "inventori",
        'model' => "App\\Models\\Inventori",
        'width' => "1",
        'color' => "success",
        'icon' => "",
        'aggregate' => "avg",
        'label_field' => "item_name",
        'value_field' => "harga_seunit",
        'filter_field' => "",
        'filter_operator' => "",
        'filter_value' => "",
        'timeframe' => "all",
        'advanced' => ["logic" => "AND", "rules" => [["table" => "inventori", "field" => "kuantiti", "operator" => ">=", "value" => "5"], ["table" => "other_table", "field" => "x", "operator" => "=", "value" => "1"]]],
    ];
}
