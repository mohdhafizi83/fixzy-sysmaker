<?php

namespace App\Filament\Exports;

use App\Models\Contact;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class ContactExporter extends Exporter
{
    protected static ?string $model = Contact::class;

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
            ExportColumn::make('full_name')->limit(50)->label('Full Name'),
            ExportColumn::make('company')->limit(50)->label('Company'),
            ExportColumn::make('email')->limit(50)->label('Email'),
            ExportColumn::make('phone')->limit(50)->label('Phone'),
            ExportColumn::make('job_title')->limit(50)->label('Job Title'),
            ExportColumn::make('notes')->limit(50)->label('Notes'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Contacts export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
