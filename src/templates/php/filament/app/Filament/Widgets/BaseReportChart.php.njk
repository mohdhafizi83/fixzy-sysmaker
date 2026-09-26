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
 *
 * Supported types (Chart.js): bar, pie, doughnut, polarArea, line,
 * area (line+fill), combo (bar+line dual axis), radar, scatter,
 * bubble. Grouped types aggregate over label_field; scatter/bubble
 * plot raw numeric X/Y pairs.
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
        return match (static::$cfg['type'] ?? 'chart_bar') {
            'chart_pie' => 'pie',
            'chart_doughnut' => 'doughnut',
            'chart_polar' => 'polarArea',
            'chart_line', 'chart_area', 'chart_combo' => 'line',
            'chart_radar' => 'radar',
            'chart_scatter' => 'scatter',
            'chart_bubble' => 'bubble',
            default => 'bar',
        };
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

    /**
     * Refresh layer: 'poll' uses Livewire polling at the configured
     * interval; 'live' relies on Echo push subscriptions (no polling);
     * 'static' disables the native 5s default polling entirely.
     */
    protected function getPollingInterval(): ?string
    {
        $mode = static::$cfg['refresh_mode'] ?? 'static';
        if ($mode === 'poll') {
            $iv = (int) (static::$cfg['refresh_interval'] ?? 10);
            return max(2, min(300, $iv)) . 's';
        }
        return null;
    }

    public function getLiveTable(): string
    {
        return (string) (static::$cfg['table'] ?? '');
    }

    public function refreshMode(): string
    {
        return (string) (static::$cfg['refresh_mode'] ?? 'static');
    }

    protected function getData(): array
    {
        $cfg = static::$cfg;
        $table = $cfg['table'] ?? '';
        $type = $cfg['type'] ?? 'chart_bar';

        if ($table === '' || ! Schema::hasTable($table)) {
            return $this->emptyData();
        }

        if ($type === 'chart_scatter' || $type === 'chart_bubble') {
            return $this->xyData();
        }

        return $this->groupedData();
    }

    /**
     * Grouped aggregate charts (bar/pie/doughnut/polar/line/area/radar/combo).
     */
    protected function groupedData(): array
    {
        $cfg = static::$cfg;
        $table = $cfg['table'] ?? '';
        $label = $cfg['label_field'] ?? '';
        $value = $cfg['value_field'] ?? '';
        $agg = $cfg['aggregate'] ?? 'count';

        if ($label === '' || ! self::safeIdent($label) || ! Schema::hasColumn($table, $label)) {
            return $this->emptyData();
        }
        if (($agg === 'sum' || $agg === 'avg') && ($value === '' || ! self::safeIdent($value) || ! Schema::hasColumn($table, $value))) {
            return $this->emptyData();
        }

        $aggSql = match ($agg) {
            'sum' => "COALESCE(SUM({$value}), 0)",
            'avg' => "COALESCE(AVG({$value}), 0)",
            default => 'COUNT(*)',
        };

        $selects = [$label, DB::raw("{$aggSql} as agg_value")];
        $groupBy = [$label];

        // Combo: second aggregate series (line overlay) over series_field.
        $seriesField = $cfg['series_field'] ?? '';
        $seriesAgg = $cfg['series_aggregate'] ?? 'sum';
        $hasSeries = ($cfg['type'] ?? '') === 'chart_combo'
            && $seriesField !== ''
            && self::safeIdent($seriesField)
            && Schema::hasColumn($table, $seriesField);
        if ($hasSeries) {
            $seriesAggSql = match ($seriesAgg) {
                'avg' => "COALESCE(AVG({$seriesField}), 0)",
                default => "COALESCE(SUM({$seriesField}), 0)",
            };
            $selects[] = DB::raw("{$seriesAggSql} as series_value");
        }

        $query = DB::table($table)->select($selects);
        ReportQuery::apply($query, $cfg);
        $rows = $query->groupBy($groupBy)->orderByDesc('agg_value')->limit(20)->get();

        $labels = [];
        $values = [];
        $series = [];
        foreach ($rows as $row) {
            $labels[] = (string) ($row->{$label} ?? '—');
            $values[] = round((float) $row->agg_value, 2);
            if ($hasSeries) {
                $series[] = round((float) ($row->series_value ?? 0), 2);
            }
        }

        $datasets = [[
            'label' => $cfg['title'] ?? 'Report',
            'data' => $values,
        ]];
        if ($hasSeries) {
            $datasets[] = [
                'label' => (string) ($cfg['series_field'] ?? 'Series'),
                'data' => $series,
                'type' => 'line',
                'yAxisID' => 'y1',
            ];
        }

        return ['labels' => $labels, 'datasets' => $datasets];
    }

    /**
     * Raw X/Y point charts (scatter/bubble). value_field = X,
     * series_field = Y, size_field = bubble radius source.
     */
    protected function xyData(): array
    {
        $cfg = static::$cfg;
        $table = $cfg['table'] ?? '';
        $x = $cfg['value_field'] ?? '';
        $y = $cfg['series_field'] ?? '';
        $size = $cfg['size_field'] ?? '';

        foreach ([$x, $y] as $col) {
            if ($col === '' || ! self::safeIdent($col) || ! Schema::hasColumn($table, $col)) {
                return $this->emptyData();
            }
        }
        if (($cfg['type'] ?? '') === 'chart_bubble'
            && ($size === '' || ! self::safeIdent($size) || ! Schema::hasColumn($table, $size))) {
            return $this->emptyData();
        }

        $cols = [$x, $y];
        if (($cfg['type'] ?? '') === 'chart_bubble') {
            $cols[] = $size;
        }

        $query = DB::table($table)->select($cols);
        ReportQuery::apply($query, $cfg);
        $rows = $query->orderBy($x)->limit(500)->get();

        // Normalize bubble radii into a sane 3..24px band.
        $sizes = [];
        foreach ($rows as $row) {
            $sizes[] = (float) ($row->{$size} ?? 0);
        }
        $maxSize = $sizes ? max(array_map('abs', $sizes)) : 0.0;

        $points = [];
        foreach ($rows as $row) {
            $p = ['x' => round((float) $row->{$x}, 2), 'y' => round((float) $row->{$y}, 2)];
            if (($cfg['type'] ?? '') === 'chart_bubble') {
                $raw = abs((float) ($row->{$size} ?? 0));
                $p['r'] = $maxSize > 0 ? (int) round(3 + ($raw / $maxSize) * 21) : 5;
            }
            $points[] = $p;
        }

        return [
            'labels' => [],
            'datasets' => [[
                'label' => $cfg['title'] ?? 'Report',
                'data' => $points,
            ]],
        ];
    }

    /**
     * Chart.js options for the special variants (area fill, combo dual
     * axis). Grouped charts keep the default axis; the combo line gets
     * its own right-hand axis so different magnitudes stay readable.
     */
    protected function getOptions(): array
    {
        $type = static::$cfg['type'] ?? '';

        if ($type === 'chart_area') {
            return [
                'datasets' => [
                    [
                        'fill' => true,
                        'backgroundColor' => $this->areaFill(),
                    ],
                ],
            ];
        }

        if ($type === 'chart_combo') {
            return [
                'scales' => [
                    'y' => [
                        'position' => 'left',
                        'beginAtZero' => true,
                    ],
                    'y1' => [
                        'position' => 'right',
                        'beginAtZero' => true,
                        'grid' => ['drawOnChartArea' => false],
                    ],
                ],
            ];
        }

        return [];
    }

    protected function emptyData(): array
    {
        return ['labels' => [], 'datasets' => [['label' => static::$cfg['title'] ?? 'Report', 'data' => []]]];
    }

    /**
     * Translucent fill for area charts, tinted by the widget color.
     */
    protected function areaFill(): string
    {
        $map = [
            'primary' => 'rgba(59, 130, 246, 0.25)',
            'success' => 'rgba(34, 197, 94, 0.25)',
            'danger' => 'rgba(239, 68, 68, 0.25)',
            'warning' => 'rgba(234, 179, 8, 0.25)',
            'info' => 'rgba(6, 182, 212, 0.25)',
            'gray' => 'rgba(107, 114, 128, 0.25)',
        ];
        return $map[static::$cfg['color'] ?? 'primary'] ?? $map['primary'];
    }

    private static function safeIdent(string $id): bool
    {
        return (bool) preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $id);
    }
}
