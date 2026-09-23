<?php

namespace App\Filament\Imports;

use App\Models\Pelajar;
use App\Models\Fakulti;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class PelajarImporter extends Importer
{
    protected static ?string $model = Pelajar::class;

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

            ImportColumn::make('fakulti')
                ->label('nama_fakulti')
                ->relationship(resolveUsing: ['nama_fakulti'])
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('nama_fakulti'),

            ImportColumn::make('nama_penuh')
                ->label('Nama Penuh')
                ->requiredMapping()
                ->helperText('Isikan nama penuh seperti didalam kad pengenalan')
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Nama Penuh 1', 'Sample Nama Penuh 2'])
                ->exampleHeader('Nama Penuh'),

            ImportColumn::make('no_matrik')
                ->label('No Matrik')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:20'])
                ->examples(['Sample No Matrik 1', 'Sample No Matrik 2'])
                ->exampleHeader('No Matrik'),

            ImportColumn::make('email')
                ->label('Email')
                ->requiredMapping()
                ->multiple(',')
                ->ignoreBlankState()
                ->rules(['required', 'max:100', 'array'])
                ->examples(['Sample Email 1', 'Sample Email 2'])
                ->exampleHeader('Email'),

            ImportColumn::make('tarikh_daftar')
                ->label('Tarikh Daftar')
                ->ignoreBlankState()
                ->rules(['date'])
                ->examples(['2024-01-01', '2024-12-31'])
                ->exampleHeader('Tarikh Daftar'),

            ImportColumn::make('gambar_profil')
                ->label('Gambar Profil')
                ->ignoreBlankState()
                ->rules(['max:255'])
                ->examples(['Sample Gambar Profil 1', 'Sample Gambar Profil 2'])
                ->exampleHeader('Gambar Profil'),

            ImportColumn::make('surat_tawaran')
                ->label('Surat Tawaran')
                ->ignoreBlankState()
                ->rules(['max:255'])
                ->examples(['Sample Surat Tawaran 1', 'Sample Surat Tawaran 2'])
                ->exampleHeader('Surat Tawaran'),

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

    public function resolveRecord(): ?Pelajar
    {
    
        return Pelajar::firstOrNew([
            'no_matrik' => $this->data['no_matrik']
        ]);
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Pelajar import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
