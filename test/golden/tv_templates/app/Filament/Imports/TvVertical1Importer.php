<?php

namespace App\Filament\Imports;

use App\Models\TvVertical1;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class TvVertical1Importer extends Importer
{
    protected static ?string $model = TvVertical1::class;

    public static function getColumns(): array
    {
        return [
            ImportColumn::make('id')
                ->label('ID')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('ID'),

            ImportColumn::make('nama_fakulti')
                ->label('Nama Fakulti')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:255'])
                ->examples(['Sample Nama Fakulti 1', 'Sample Nama Fakulti 2'])
                ->exampleHeader('Nama Fakulti'),

            ImportColumn::make('created_at')
                ->label('Created At')
                ->ignoreBlankState()
                ->rules(['datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Created At'),

            ImportColumn::make('updated_at')
                ->label('Updated At')
                ->ignoreBlankState()
                ->rules(['datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Updated At'),

            ImportColumn::make('deleted_at')
                ->label('Deleted At')
                ->ignoreBlankState()
                ->rules(['datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Deleted At'),
        ];
    }

    public function resolveRecord(): ?TvVertical1
    {
    return new TvVertical1();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Tv Vertical1 import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
