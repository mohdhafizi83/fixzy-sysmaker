<?php

namespace App\Filament\Imports;

use App\Models\Tempahan;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class TempahanImporter extends Importer
{
    protected static ?string $model = Tempahan::class;

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

            ImportColumn::make('nama')
                ->label('Nama')
                ->ignoreBlankState()
                ->rules(['max:255'])
                ->examples(['Sample Nama 1', 'Sample Nama 2'])
                ->exampleHeader('Nama'),

            ImportColumn::make('country')
                ->label('Country')
                ->ignoreBlankState()
                ->rules(['max:255'])
                ->examples(['Sample Country 1', 'Sample Country 2'])
                ->exampleHeader('Country'),

            ImportColumn::make('state')
                ->label('State')
                ->ignoreBlankState()
                ->rules(['max:255'])
                ->examples(['Sample State 1', 'Sample State 2'])
                ->exampleHeader('State'),

            ImportColumn::make('notes')
                ->label('Notes')
                ->ignoreBlankState()
                ->rules(['max:255'])
                ->examples(['Sample Notes 1', 'Sample Notes 2'])
                ->exampleHeader('Notes'),

            ImportColumn::make('agree')
                ->label('Agree')
                ->boolean()
                ->ignoreBlankState()
                ->rules(['max:255'])
                ->examples(['1', '0'])
                ->exampleHeader('Agree'),
        ];
    }

    public function resolveRecord(): ?Tempahan
    {
    return new Tempahan();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Tempahan import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
