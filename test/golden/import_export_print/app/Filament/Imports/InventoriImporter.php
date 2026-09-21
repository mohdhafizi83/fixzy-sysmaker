<?php

namespace App\Filament\Imports;

use App\Models\Inventori;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class InventoriImporter extends Importer
{
    protected static ?string $model = Inventori::class;

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

            ImportColumn::make('item_name')
                ->label('Item Name')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Item Name 1', 'Sample Item Name 2'])
                ->exampleHeader('Item Name'),

            ImportColumn::make('kuantiti')
                ->label('Kuantiti')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Kuantiti'),

            ImportColumn::make('harga_seunit')
                ->label('Harga Seunit')
                ->numeric()
                ->ignoreBlankState()
                ->rules(['max:10'])
                ->examples(['Sample Harga Seunit 1', 'Sample Harga Seunit 2'])
                ->exampleHeader('Harga Seunit'),
        ];
    }

    public function resolveRecord(): ?Inventori
    {
    return new Inventori();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Inventori import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
