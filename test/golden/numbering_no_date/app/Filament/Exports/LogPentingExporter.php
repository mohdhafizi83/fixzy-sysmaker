<?php

namespace App\Filament\Exports;

use App\Models\LogPenting;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class LogPentingExporter extends Exporter
{
    protected static ?string $model = LogPenting::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('perihal')->limit(50)->label('Perihal'),
            ExportColumn::make('perihal_status')->label('Status'),
            ExportColumn::make('ticket_no')->label('Ticket No'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Log Penting export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
