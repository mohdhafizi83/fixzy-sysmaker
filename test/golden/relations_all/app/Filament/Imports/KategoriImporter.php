<?php

namespace App\Filament\Imports;

use App\Models\Kategori;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class KategoriImporter extends Importer
{
    protected static ?string $model = Kategori::class;

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

            ImportColumn::make('nama_kategori')
                ->label('Nama Kategori')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:100'])
                ->examples(['Sample Nama Kategori 1', 'Sample Nama Kategori 2'])
                ->exampleHeader('Nama Kategori'),

            ImportColumn::make('parent_kategori_id')
                ->label('Parent Kategori Id')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Parent Kategori Id'),
        ];
    }

    public function resolveRecord(): ?Kategori
    {
    return new Kategori();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Kategori import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
