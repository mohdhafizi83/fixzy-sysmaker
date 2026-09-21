<?php

namespace App\Filament\Exports;

use App\Models\SemuaField;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class SemuaFieldExporter extends Exporter
{
    protected static ?string $model = SemuaField::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('teks_biasa')->limit(50)->label('Teks Biasa'),
            ExportColumn::make('emel')->limit(50)->label('Emel'),
            ExportColumn::make('katalaluan')->limit(50)->label('Katalaluan'),
            ExportColumn::make('telefon')->limit(50)->label('Telefon'),
            ExportColumn::make('pautan')->limit(50)->label('Pautan'),
            ExportColumn::make('berkas_topeng')->limit(50)->label('Berkas Topeng'),
            ExportColumn::make('umur')->limit(50)->label('Umur'),
            ExportColumn::make('gaji')->limit(50)->label('Gaji'),
            ExportColumn::make('kod_zero')->limit(50)->label('Kod Zero'),
            ExportColumn::make('unik_kod')->limit(50)->label('Unik Kod'),
            ExportColumn::make('cerita')->limit(50)->label('Cerita'),
            ExportColumn::make('rich_teks')->limit(50)->label('Rich Teks'),
            ExportColumn::make('aktif')->limit(50)->label('Aktif'),
            ExportColumn::make('status')->limit(50)->label('Status'),
            ExportColumn::make('tag_multi')->limit(50)->label('Tag Multi'),
            ExportColumn::make('tarikh_masa')->limit(50)->label('Tarikh Masa'),
            ExportColumn::make('emel_berulang')->limit(50)->listAsJson()->label('Emel Berulang'),
            ExportColumn::make('butiran')->limit(50)->listAsJson()->label('Butiran'),
            ExportColumn::make('helper_cara')->limit(50)->label('Helper Cara'),
            ExportColumn::make('auto_off')->limit(50)->label('Auto Off'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Semua Field export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
