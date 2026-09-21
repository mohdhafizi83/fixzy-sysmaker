<?php

namespace App\Filament\Imports;

use App\Models\Organisasi;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class OrganisasiImporter extends Importer
{
    protected static ?string $model = Organisasi::class;

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

            ImportColumn::make('nama_organisasi')
                ->label('Nama Organisasi')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Nama Organisasi 1', 'Sample Nama Organisasi 2'])
                ->exampleHeader('Nama Organisasi'),
        ];
    }

    public function resolveRecord(): ?Organisasi
    {
    return new Organisasi();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Organisasi import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
