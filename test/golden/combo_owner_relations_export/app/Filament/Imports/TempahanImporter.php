<?php

namespace App\Filament\Imports;

use App\Models\Tempahan;
use App\Models\Pelanggan;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class TempahanImporter extends Importer
{
    protected static ?string $model = Tempahan::class;

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

            ImportColumn::make('pelanggan_id')
                ->label('Pelanggan Id')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Pelanggan Id'),

            ImportColumn::make('no_tempahan')
                ->label('No Tempahan')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:40'])
                ->examples(['Sample No Tempahan 1', 'Sample No Tempahan 2'])
                ->exampleHeader('No Tempahan'),

            ImportColumn::make('created_by')
                ->label('Created By')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Created By'),

            ImportColumn::make('updated_by')
                ->label('Updated By')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Updated By'),
        ];
    }

    public function resolveRecord(): ?Tempahan
    {
    
        return Tempahan::firstOrNew([
            'no_tempahan' => $this->data['no_tempahan']
        ]);
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Tempahan import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
