<?php

namespace App\Filament\Exports;

use App\Models\JanaBil;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class JanaBilExporter extends Exporter
{
    protected static ?string $model = JanaBil::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('bil_1')->limit(50)->label('Bil 1'),
            ExportColumn::make('bil_2')->limit(50)->label('Bil 2'),
            ExportColumn::make('jumlah')->limit(50)->label('Jumlah'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Jana Bil export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
