<?php

namespace App\Filament\Imports;

use App\Models\Produk;
use App\Models\Organisasi;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class ProdukImporter extends Importer
{
    protected static ?string $model = Produk::class;

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

            ImportColumn::make('nama_produk')
                ->label('Nama Produk')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Nama Produk 1', 'Sample Nama Produk 2'])
                ->exampleHeader('Nama Produk'),

            ImportColumn::make('harga')
                ->label('Harga')
                ->numeric()
                ->ignoreBlankState()
                ->rules(['max:10'])
                ->examples(['Sample Harga 1', 'Sample Harga 2'])
                ->exampleHeader('Harga'),
        ];
    }

    public function resolveRecord(): ?Produk
    {
    return new Produk();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Produk import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
