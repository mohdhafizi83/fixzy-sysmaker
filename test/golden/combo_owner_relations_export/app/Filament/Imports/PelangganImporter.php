<?php

namespace App\Filament\Imports;

use App\Models\Pelanggan;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class PelangganImporter extends Importer
{
    protected static ?string $model = Pelanggan::class;

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

            ImportColumn::make('nama_pelanggan')
                ->label('Nama Pelanggan')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Nama Pelanggan 1', 'Sample Nama Pelanggan 2'])
                ->exampleHeader('Nama Pelanggan'),

            ImportColumn::make('emel')
                ->label('Emel')
                ->ignoreBlankState()
                ->rules(['max:150', 'email'])
                ->examples(['user1@example.com', 'user2@example.com'])
                ->exampleHeader('Emel'),
        ];
    }

    public function resolveRecord(): ?Pelanggan
    {
    
        return Pelanggan::firstOrNew([
            'emel' => $this->data['emel']
        ]);
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Pelanggan import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
