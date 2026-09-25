<?php

namespace App\Filament\Exports;

use App\Models\User;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Models\Export;
use Illuminate\Support\Number;

class UserExporter extends Exporter
{
    protected static ?string $model = User::class;

    public static function getColumns(): array
    {
        return [
                        ExportColumn::make('id')->limit(50)->label('Id'),
            ExportColumn::make('name')->limit(50)->label('Name'),
            ExportColumn::make('email')->limit(50)->label('Email'),
            ExportColumn::make('email_verified_at')->limit(50)->label('Email Verified At'),
            ExportColumn::make('password')->limit(50)->label('Password'),
            ExportColumn::make('remember_token')->limit(50)->label('Remember Token'),
            ExportColumn::make('created_at')->limit(50)->label('Created At'),
            ExportColumn::make('updated_at')->limit(50)->label('Updated At'),
            ExportColumn::make('deleted_at')->limit(50)->label('Deleted At'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        $body = 'Your Users export has completed and ' . Number::format($export->successful_rows) . ' ' . str('row')->plural($export->successful_rows) . ' exported.';

        if ($failedRowsCount = $export->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to export.';
        }

        return $body;
    }
}
