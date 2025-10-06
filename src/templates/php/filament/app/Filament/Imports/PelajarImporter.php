<?php

namespace App\Filament\Imports;

use App\Models\Pelajar;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;

class PelajarImporter extends Importer
{
    protected static ?string $model = Pelajar::class;

    public static function getColumns(): array
    {
        return [
            ImportColumn::make('nama_penuh')
                ->requiredMapping()
                ->rules(['required']),
            ImportColumn::make('no_matrik')
                ->requiredMapping()
                ->rules(['required']),
            ImportColumn::make('email')
                ->requiredMapping()
                ->rules(['required', 'email']),
            ImportColumn::make('tarikh_daftar')
                ->rules(['date']),
            ImportColumn::make('gambar_profil'),
        ];
    }

    public function resolveRecord(): Pelajar
    {
        return new Pelajar();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your pelajar import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

        if ($failedRowsCount = $import->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to import.';
        }

        return $body;
    }
}
