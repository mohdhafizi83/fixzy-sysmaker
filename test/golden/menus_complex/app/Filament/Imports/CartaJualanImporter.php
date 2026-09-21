<?php

namespace App\Filament\Imports;

use App\Models\CartaJualan;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class CartaJualanImporter extends Importer
{
    protected static ?string $model = CartaJualan::class;

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

            ImportColumn::make('kategori')
                ->label('Kategori')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:50'])
                ->examples(['Sample Kategori 1', 'Sample Kategori 2'])
                ->exampleHeader('Kategori'),
        ];
    }

    public function resolveRecord(): ?CartaJualan
    {
    return new CartaJualan();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Carta Jualan import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
