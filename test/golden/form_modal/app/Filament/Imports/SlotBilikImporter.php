<?php

namespace App\Filament\Imports;

use App\Models\SlotBilik;
use App\Models\Bilik;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class SlotBilikImporter extends Importer
{
    protected static ?string $model = SlotBilik::class;

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

            ImportColumn::make('slot_label')
                ->label('Slot Label')
                ->ignoreBlankState()
                ->rules(['max:255'])
                ->examples(['Sample Slot Label 1', 'Sample Slot Label 2'])
                ->exampleHeader('Slot Label'),

            ImportColumn::make('bilik')
                ->label('no_bilik')
                ->relationship(resolveUsing: ['no_bilik'])
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('no_bilik'),
        ];
    }

    public function resolveRecord(): ?SlotBilik
    {
    return new SlotBilik();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Slot Bilik import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
