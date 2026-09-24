<?php

namespace App\Filament\Widgets;

use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Base class for generated stat cards. Compiled config lives in a
 * protected static property (baked at generation time) so it never
 * travels in the Livewire payload.
 */
abstract class BaseReportStats extends StatsOverviewWidget
{
    /** @var array<string, mixed> */
    protected static array $cfg = [];

    public function getColumnSpan(): int | string | array
    {
        $w = static::$cfg['width'] ?? '1';
        return $w === 'full' ? 'full' : (int) $w;
    }

    protected function getStats(): array
    {
        $cfg = static::$cfg;
        $table = $cfg['table'] ?? '';
        $agg = $cfg['aggregate'] ?? 'count';
        $value = $cfg['value_field'] ?? '';

        if ($table === '' || ! Schema::hasTable($table)
            || (($agg === 'sum' || $agg === 'avg') && ($value === '' || ! Schema::hasColumn($table, $value)))) {
            return [Stat::make($cfg['title'] ?? 'Report', '—')];
        }
        if (! preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $table) || ($value !== '' && ! preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $value))) {
            return [Stat::make($cfg['title'] ?? 'Report', '—')];
        }

        $query = DB::table($table);
        ReportQuery::apply($query, $cfg);

        $result = match ($agg) {
            'sum' => (float) $query->sum($value),
            'avg' => (float) $query->avg($value),
            default => (int) $query->count(),
        };

        $display = ($agg === 'count')
            ? number_format($result)
            : number_format($result, 2);

        $stat = Stat::make($cfg['title'] ?? 'Report', $display)
            ->color($cfg['color'] ?? 'primary');
        if (! empty($cfg['icon'])) {
            $stat->descriptionIcon($cfg['icon'], \Filament\Support\Enums\IconPosition::Before);
        }

        return [$stat];
    }
}
