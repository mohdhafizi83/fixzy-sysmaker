<?php

namespace App\Filament\Exports;

use App\Models\ItemTempahan;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class ItemTempahanExporter extends Exporter
{
    protected static ?string $model = ItemTempahan::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('tempahan.id')->limit(50)->label('Tempahan Id'),
            ExportColumn::make('produk')->limit(50)->label('Produk'),
            ExportColumn::make('kuantiti')->limit(50)->label('Kuantiti'),
            ExportColumn::make('harga')->limit(50)->label('Harga'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Item Tempahan export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
