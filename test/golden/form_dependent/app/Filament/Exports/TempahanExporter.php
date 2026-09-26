<?php

namespace App\Filament\Exports;

use App\Models\Tempahan;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class TempahanExporter extends Exporter
{
    protected static ?string $model = Tempahan::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('created_at')->limit(50)->label('Created At'),
            ExportColumn::make('updated_at')->limit(50)->label('Updated At'),
            ExportColumn::make('deleted_at')->limit(50)->label('Deleted At'),
            ExportColumn::make('nama')->limit(50)->label('Nama'),
            ExportColumn::make('bilik.no_bilik')->limit(50)->label('No Bilik'),
            ExportColumn::make('slotBilik.slot_label')->limit(50)->label('Slot Label'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Tempahan export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
