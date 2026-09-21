<?php

namespace App\Filament\Imports;

use App\Models\LaporanHarian;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class LaporanHarianImporter extends Importer
{
    protected static ?string $model = LaporanHarian::class;

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

            ImportColumn::make('tarikh_laporan')
                ->label('Tarikh Laporan')
                ->ignoreBlankState()
                ->rules(['max:255', 'datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Tarikh Laporan'),
        ];
    }

    public function resolveRecord(): ?LaporanHarian
    {
    return new LaporanHarian();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Laporan Harian import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
