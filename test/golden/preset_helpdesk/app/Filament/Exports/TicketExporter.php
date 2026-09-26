<?php

namespace App\Filament\Exports;

use App\Models\Ticket;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class TicketExporter extends Exporter
{
    protected static ?string $model = Ticket::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('created_at')->limit(50)->label('Created At'),
            ExportColumn::make('updated_at')->limit(50)->label('Updated At'),
            ExportColumn::make('deleted_at')->limit(50)->label('Deleted At'),
            ExportColumn::make('created_by')->limit(50)->label('Created By'),
            ExportColumn::make('updated_by')->limit(50)->label('Updated By'),
            ExportColumn::make('deleted_by')->limit(50)->label('Deleted By'),
            ExportColumn::make('ticket_no')->limit(50)->label('Ticket No'),
            ExportColumn::make('subject')->limit(50)->label('Subject'),
            ExportColumn::make('requester_name')->limit(50)->label('Requester'),
            ExportColumn::make('requester_email')->limit(50)->label('Requester Email'),
            ExportColumn::make('priority')->limit(50)->label('Priority'),
            ExportColumn::make('ticket_status')->limit(50)->label('Status'),
            ExportColumn::make('assigned_to')->limit(50)->label('Assigned Agent'),
            ExportColumn::make('description')->limit(50)->label('Issue Description'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Tickets export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
