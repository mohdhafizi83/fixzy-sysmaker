<?php

namespace App\Filament\Exports;

use App\Models\DokumenPelajar;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class DokumenPelajarExporter extends Exporter
{
    protected static ?string $model = DokumenPelajar::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('pelajar.nama_penuh')->limit(50)->label('Nama Penuh'),
            ExportColumn::make('nama_fail')->limit(50)->label('Nama Fail'),
            ExportColumn::make('path_fail')->limit(50)->label('Path Fail'),
            ExportColumn::make('jenis_dokumen')->limit(50)->label('Jenis Dokumen'),
            ExportColumn::make('tarikh_muatnaik')->limit(50)->label('Tarikh Muatnaik'),
            ExportColumn::make('created_at')->limit(50)->label('Created At'),
            ExportColumn::make('updated_at')->limit(50)->label('Updated At'),
            ExportColumn::make('deleted_at')->limit(50)->label('Deleted At'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Dokumen Pelajar export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
