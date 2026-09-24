<?php

namespace App\Filament\Exports;

use App\Models\TvVertical2;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class TvVertical2Exporter extends Exporter
{
    protected static ?string $model = TvVertical2::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('nama_fakulti')->limit(50)->label('Nama Fakulti'),
            ExportColumn::make('created_at')->limit(50)->label('Created At'),
            ExportColumn::make('updated_at')->limit(50)->label('Updated At'),
            ExportColumn::make('deleted_at')->limit(50)->label('Deleted At'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Tv Vertical2 export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
