<?php

namespace App\Filament\Exports;

use App\Models\Kursus;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class KursusExporter extends Exporter
{
    protected static ?string $model = Kursus::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('nama_kursus')->limit(50)->label('Nama Kursus'),
            ExportColumn::make('kod_kursus')->limit(50)->label('Kod Kursus'),
            ExportColumn::make('deskripsi')->limit(50)->label('Deskripsi'),
            ExportColumn::make('jam_kredit')->limit(50)->label('Jam Kredit'),
            ExportColumn::make('parent.nama_kursus')->limit(50)->label('Nama Kursus'),
            ExportColumn::make('lokasi_kelas')->limit(50)->label('Lokasi Kelas'),
            ExportColumn::make('created_at')->limit(50)->label('Created At'),
            ExportColumn::make('youtube_intro')->limit(50)->label('Youtube Intro'),
            ExportColumn::make('updated_at')->limit(50)->label('Updated At'),
            ExportColumn::make('deleted_at')->limit(50)->label('Deleted At'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Kursus export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
