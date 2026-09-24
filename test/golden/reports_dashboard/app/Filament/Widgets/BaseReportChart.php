<?php

namespace App\Filament\Widgets;

use Filament\Widgets\ChartWidget;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Base class for generated report charts. The compiled report config
 * lives in a protected static property (baked at generation time),
 * never in the Livewire payload — so it cannot be tampered with from
 * the browser.
 */
abstract class BaseReportChart extends ChartWidget
{
    /** @var array<string, mixed> */
    protected static array $cfg = [];

    public function getColumnSpan(): int | string | array
    {
        $w = static::$cfg['width'] ?? '1';
        return $w === 'full' ? 'full' : (int) $w;
    }

    protected function getType(): string
    {
        return (static::$cfg['type'] ?? 'chart_bar') === 'chart_pie' ? 'pie' : 'bar';
    }

    public function getHeading(): string | \Illuminate\Contracts\Support\Htmlable | null
    {
        return static::$cfg['title'] ?? 'Report';
    }

    public function getColor(): string
    {
        $c = static::$cfg['color'] ?? 'primary';
        return in_array($c, ['primary', 'success', 'danger', 'warning', 'info', 'gray'], true) ? $c : 'primary';
    }

    protected function getMaxHeight(): ?string
    {
        return '320px';
    }

    protected function getData(): array
    {
        $cfg = static::$cfg;
        $table = $cfg['table'] ?? '';
        $label = $cfg['label_field'] ?? '';
        $value = $cfg['value_field'] ?? '';
        $agg = $cfg['aggregate'] ?? 'count';

        if ($table === '' || $label === '' || ! Schema::hasTable($table) || ! Schema::hasColumn($table, $label)) {
            return ['labels' => [], 'datasets' => [['label' => $cfg['title'] ?? 'Report', 'data' => []]]];
        }
        if (($agg === 'sum' || $agg === 'avg') && ($value === '' || ! Schema::hasColumn($table, $value))) {
            return ['labels' => [], 'datasets' => [['label' => $cfg['title'] ?? 'Report', 'data' => []]]];
        }
        if (! preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $label) || ($value !== '' && ! preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $value))) {
            return ['labels' => [], 'datasets' => [['label' => $cfg['title'] ?? 'Report', 'data' => []]]];
        }

        $aggSql = match ($agg) {
            'sum' => "COALESCE(SUM({$value}), 0)",
            'avg' => "COALESCE(AVG({$value}), 0)",
            default => 'COUNT(*)',
        };

        $query = DB::table($table)
            ->select($label, DB::raw("{$aggSql} as agg_value"));

        ReportQuery::apply($query, $cfg);

        $rows = $query->groupBy($label)->orderByDesc('agg_value')->limit(20)->get();

        $labels = [];
        $values = [];
        foreach ($rows as $row) {
            $labels[] = (string) ($row->{$label} ?? '—');
            $values[] = round((float) $row->agg_value, 2);
        }

        return [
            'labels' => $labels,
            'datasets' => [[
                'label' => $cfg['title'] ?? 'Report',
                'data' => $values,
            ]],
        ];
    }
}
