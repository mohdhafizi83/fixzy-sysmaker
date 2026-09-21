<?php

namespace App\Filament\Exports;

use App\Models\ProfilPelajar;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class ProfilPelajarExporter extends Exporter
{
    protected static ?string $model = ProfilPelajar::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('pelajar.nama_penuh')->limit(50)->label('Nama Penuh'),
            ExportColumn::make('alamat')->limit(50)->label('Alamat'),
            ExportColumn::make('no_telefon')->limit(50)->label('No Telefon'),
            ExportColumn::make('tarikh_lahir')->limit(50)->label('Tarikh Lahir'),
            ExportColumn::make('info_kecemasan')->limit(50)->label('Info Kecemasan'),
            ExportColumn::make('created_at')->limit(50)->label('Created At'),
            ExportColumn::make('updated_at')->limit(50)->label('Updated At'),
            ExportColumn::make('deleted_at')->limit(50)->label('Deleted At'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Profil Pelajar export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
