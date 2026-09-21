<?php

namespace App\Filament\Imports;

use App\Models\Sekolah;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class SekolahImporter extends Importer
{
    protected static ?string $model = Sekolah::class;

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

            ImportColumn::make('nama_sekolah')
                ->label('Nama Sekolah')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Nama Sekolah 1', 'Sample Nama Sekolah 2'])
                ->exampleHeader('Nama Sekolah'),
        ];
    }

    public function resolveRecord(): ?Sekolah
    {
    return new Sekolah();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Sekolah import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
