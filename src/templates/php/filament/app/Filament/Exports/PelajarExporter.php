<?php

namespace App\Filament\Exports;

use App\Models\Pelajar;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class PelajarExporter extends Exporter
{
    protected static ?string $model = Pelajar::class;

    public static function getColumns(): array
    {
        return [
            ExportColumn::make('id_pelajar'),
            ExportColumn::make('nama_penuh'),
            ExportColumn::make('no_matrik'),
            ExportColumn::make('email'),
            ExportColumn::make('tarikh_daftar'),
            ExportColumn::make('gambar_profil'),
            ExportColumn::make('created_at'),
            ExportColumn::make('updated_at'),
            ExportColumn::make('deleted_at'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your pelajar export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
