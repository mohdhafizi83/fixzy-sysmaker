<?php

namespace App\Filament\Exports;

use App\Models\KeputusanUjian;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class KeputusanUjianExporter extends Exporter
{
    protected static ?string $model = KeputusanUjian::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('pelajar.nama_penuh')->limit(50)->label('Nama Penuh'),
            ExportColumn::make('test')->limit(50)->label('Test'),
            ExportColumn::make('created_at')->limit(50)->label('Created At'),
            ExportColumn::make('updated_at')->limit(50)->label('Updated At'),
            ExportColumn::make('deleted_at')->limit(50)->label('Deleted At'),
            ExportColumn::make('created_by')->limit(50)->label('Created By'),
            ExportColumn::make('updated_by')->limit(50)->label('Updated By'),
            ExportColumn::make('deleted_by')->limit(50)->label('Deleted By'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Keputusan Ujian export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
