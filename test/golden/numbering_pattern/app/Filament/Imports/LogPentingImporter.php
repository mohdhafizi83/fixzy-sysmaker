<?php

namespace App\Filament\Imports;

use App\Models\LogPenting;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class LogPentingImporter extends Importer
{
    protected static ?string $model = LogPenting::class;

    public static function getColumns(): array
    {
        return [
            ImportColumn::make('id')
                ->label('Id')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Id'),

            ImportColumn::make('perihal')
                ->label('Perihal')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:200'])
                ->examples(['Sample Perihal 1', 'Sample Perihal 2'])
                ->exampleHeader('Perihal'),

            ImportColumn::make('perihal_status')
                ->label('Status')
                ->ignoreBlankState()
                ->rules(['max:50'])
                ->examples(['Sample Status 1', 'Sample Status 2'])
                ->exampleHeader('Status'),

            ImportColumn::make('invoice_no')
                ->label('Invoice No')
                ->ignoreBlankState()
                ->examples(['Sample Invoice No 1', 'Sample Invoice No 2'])
                ->exampleHeader('Invoice No'),
        ];
    }

    public function resolveRecord(): ?LogPenting
    {
    return new LogPenting();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Log Penting import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

        if ($failedRowsCount = $import->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to import.';
        }

        return $body;
    }
    
    public static function getOptionsFormComponents(): array
    {
        return [
            Checkbox::make('updateExisting')
                ->label('Update existing records'),
        ];
    }

}
