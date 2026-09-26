<?php

namespace App\Filament\Imports;

use App\Models\Nota;
use App\Models\Projek;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class NotaImporter extends Importer
{
    protected static ?string $model = Nota::class;

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

            ImportColumn::make('projek_id')
                ->label('Projek Id')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Projek Id'),

            ImportColumn::make('isi_nota')
                ->label('Isi Nota')
                ->ignoreBlankState()
                ->rules(['max:255'])
                ->examples(['Sample Isi Nota 1', 'Sample Isi Nota 2'])
                ->exampleHeader('Isi Nota'),
        ];
    }

    public function resolveRecord(): ?Nota
    {
    return new Nota();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Nota import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
