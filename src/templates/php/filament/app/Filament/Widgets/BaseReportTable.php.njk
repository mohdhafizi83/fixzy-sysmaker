<?php

namespace App\Filament\Widgets;

use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Base class for generated latest-records tables. Compiled config
 * lives in a protected static property (baked at generation time).
 *
 * Filament's TableWidget requires an Eloquent query, so we run the
 * compiled filters on a raw query builder and hydrate the result
 * into the generated model via fromQuery().
 */
abstract class BaseReportTable extends TableWidget
{
    /** @var array<string, mixed> */
    protected static array $cfg = [];

    public function getColumnSpan(): int | string | array
    {
        $w = static::$cfg['width'] ?? '1';
        return $w === 'full' ? 'full' : (int) $w;
    }

    protected function getTableQuery(): EloquentBuilder | \Illuminate\Database\Eloquent\Relations\Relation | null
    {
        $cfg = static::$cfg;
        $table = $cfg['table'] ?? '';
        $modelClass = $cfg['model'] ?? '';
        if ($table === '' || ! Schema::hasTable($table)
            || ! preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $table)
            || ! class_exists($modelClass)) {
            return null;
        }

        /** @var \Illuminate\Database\Eloquent\Model $model */
        $model = new $modelClass();
        $model->setTable($table);
        $query = $model->newQuery();
        // Apply compiled filters on the underlying raw builder.
        ReportQuery::apply($query->getQuery(), $cfg);

        $orderCol = Schema::hasColumn($table, 'created_at') ? 'created_at' : null;
        if ($orderCol === null && Schema::hasColumn($table, 'id')) {
            $orderCol = 'id';
        }
        if ($orderCol) {
            $query->orderByDesc($orderCol);
        }
        $query->limit(50);

        return $query;
    }

    public function table(Table $table): Table
    {
        $cfg = static::$cfg;
        $source = $cfg['table'] ?? '';
        $columns = [];
        if ($source !== '' && Schema::hasTable($source)) {
            $skip = ['remember_token', 'password', 'deleted_at'];
            $cols = Schema::getColumnListing($source);
            $cols = array_values(array_filter($cols, fn ($c) => ! in_array($c, $skip, true)));
            $cols = array_slice($cols, 0, 8);
            foreach ($cols as $col) {
                $columns[] = \Filament\Tables\Columns\TextColumn::make($col)
                    ->label(ucwords(str_replace('_', ' ', $col)))
                    ->limit(30)
                    ->sortable(false);
            }
        }

        return $table
            ->heading($cfg['title'] ?? 'Latest records')
            ->columns($columns)
            ->paginated(false)
            ->headerActions([]);
    }
}
