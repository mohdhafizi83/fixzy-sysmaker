<?php

namespace App\Filament\Exports;

use App\Models\Inventori;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class InventoriExporter extends Exporter
{
    protected static ?string $model = Inventori::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('item_name')->limit(50)->label('Item Name'),
            ExportColumn::make('kuantiti')->limit(50)->label('Kuantiti'),
            ExportColumn::make('harga_seunit')->limit(50)->label('Harga Seunit'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Inventori export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
