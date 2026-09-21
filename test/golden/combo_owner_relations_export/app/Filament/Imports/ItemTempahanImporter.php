<?php

namespace App\Filament\Imports;

use App\Models\ItemTempahan;
use App\Models\Tempahan;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class ItemTempahanImporter extends Importer
{
    protected static ?string $model = ItemTempahan::class;

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

            ImportColumn::make('tempahan_id')
                ->label('Tempahan Id')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Tempahan Id'),

            ImportColumn::make('produk')
                ->label('Produk')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:100'])
                ->examples(['Sample Produk 1', 'Sample Produk 2'])
                ->exampleHeader('Produk'),

            ImportColumn::make('kuantiti')
                ->label('Kuantiti')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Kuantiti'),

            ImportColumn::make('harga')
                ->label('Harga')
                ->numeric()
                ->ignoreBlankState()
                ->rules(['max:10'])
                ->examples(['Sample Harga 1', 'Sample Harga 2'])
                ->exampleHeader('Harga'),
        ];
    }

    public function resolveRecord(): ?ItemTempahan
    {
    return new ItemTempahan();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Item Tempahan import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
