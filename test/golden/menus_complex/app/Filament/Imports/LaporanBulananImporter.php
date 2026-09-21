<?php

namespace App\Filament\Imports;

use App\Models\LaporanBulanan;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class LaporanBulananImporter extends Importer
{
    protected static ?string $model = LaporanBulanan::class;

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

            ImportColumn::make('bulan')
                ->label('Bulan')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:20'])
                ->examples(['Sample Bulan 1', 'Sample Bulan 2'])
                ->exampleHeader('Bulan'),
        ];
    }

    public function resolveRecord(): ?LaporanBulanan
    {
    return new LaporanBulanan();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Laporan Bulanan import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
