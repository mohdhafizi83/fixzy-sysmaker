<?php

namespace App\Filament\Imports;

use App\Models\Kela;
use App\Models\Sekolah;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class KelaImporter extends Importer
{
    protected static ?string $model = Kela::class;

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

            ImportColumn::make('sekolah_id')
                ->label('Sekolah Id')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Sekolah Id'),

            ImportColumn::make('nama_kelas')
                ->label('Nama Kelas')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:100'])
                ->examples(['Sample Nama Kelas 1', 'Sample Nama Kelas 2'])
                ->exampleHeader('Nama Kelas'),
        ];
    }

    public function resolveRecord(): ?Kela
    {
    return new Kela();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Kelas import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
