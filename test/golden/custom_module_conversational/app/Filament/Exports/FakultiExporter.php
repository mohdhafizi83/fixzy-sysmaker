<?php

namespace App\Filament\Exports;

use App\Models\Fakulti;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class FakultiExporter extends Exporter
{
    protected static ?string $model = Fakulti::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('nama_fakulti')->limit(50)->label('Nama Fakulti'),
            ExportColumn::make('kod_fakulti')->limit(50)->label('Kod Fakulti'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Fakulti export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
