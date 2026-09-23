<?php

namespace App\Filament\Imports;

use App\Models\DokumenPelajar;
use App\Models\Pelajar;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class DokumenPelajarImporter extends Importer
{
    protected static ?string $model = DokumenPelajar::class;

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

            ImportColumn::make('pelajar')
                ->label('nama_penuh')
                ->requiredMapping()
                ->relationship(resolveUsing: ['nama_penuh'])
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['required', 'integer'])
                ->examples(['1', '2'])
                ->exampleHeader('nama_penuh'),

            ImportColumn::make('nama_fail')
                ->label('Nama Fail')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:200'])
                ->examples(['Sample Nama Fail 1', 'Sample Nama Fail 2'])
                ->exampleHeader('Nama Fail'),

            ImportColumn::make('path_fail')
                ->label('Path Fail')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:255'])
                ->examples(['Sample Path Fail 1', 'Sample Path Fail 2'])
                ->exampleHeader('Path Fail'),

            ImportColumn::make('jenis_dokumen')
                ->label('Jenis Dokumen')
                ->ignoreBlankState()
                ->rules(['max:50'])
                ->examples(['Sample Jenis Dokumen 1', 'Sample Jenis Dokumen 2'])
                ->exampleHeader('Jenis Dokumen'),

            ImportColumn::make('tarikh_muatnaik')
                ->label('Tarikh Muatnaik')
                ->ignoreBlankState()
                ->rules(['datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Tarikh Muatnaik'),

            ImportColumn::make('created_at')
                ->label('Created At')
                ->ignoreBlankState()
                ->rules(['datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Created At'),

            ImportColumn::make('updated_at')
                ->label('Updated At')
                ->ignoreBlankState()
                ->rules(['datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Updated At'),

            ImportColumn::make('deleted_at')
                ->label('Deleted At')
                ->ignoreBlankState()
                ->rules(['datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Deleted At'),
        ];
    }

    public function resolveRecord(): ?DokumenPelajar
    {
    return new DokumenPelajar();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Dokumen Pelajar import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
