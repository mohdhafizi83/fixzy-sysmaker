<?php

namespace App\Filament\Imports;

use App\Models\PengesahanPendaftaran;
use App\Models\PendaftaranKursus;
use App\Models\User;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class PengesahanPendaftaranImporter extends Importer
{
    protected static ?string $model = PengesahanPendaftaran::class;

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

            ImportColumn::make('pendaftaranKursus')
                ->label('tarikh_pendaftaran')
                ->requiredMapping()
                ->relationship(resolveUsing: ['tarikh_pendaftaran'])
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['required', 'integer'])
                ->examples(['1', '2'])
                ->exampleHeader('tarikh_pendaftaran'),

            ImportColumn::make('user')
                ->label('name')
                ->requiredMapping()
                ->relationship(resolveUsing: ['name'])
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['required', 'integer'])
                ->examples(['1', '2'])
                ->exampleHeader('name'),

            ImportColumn::make('status')
                ->label('Status')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:15'])
                ->examples(['Sample Status 1', 'Sample Status 2'])
                ->exampleHeader('Status'),

            ImportColumn::make('catatan')
                ->label('Catatan')
                ->ignoreBlankState()
                ->examples(['Sample Catatan 1', 'Sample Catatan 2'])
                ->exampleHeader('Catatan'),

            ImportColumn::make('tarikh_tindakan')
                ->label('Tarikh Tindakan')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Tarikh Tindakan'),

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

    public function resolveRecord(): ?PengesahanPendaftaran
    {
    
        $pendaftaranKursus = PendaftaranKursus::firstWhere('tarikh_pendaftaran', $this->data['pendaftaranKursus'] ?? null);

        if (!$pendaftaranKursus) {
            return null;
        }

        return PengesahanPendaftaran::firstOrNew([
            'pendaftaran_id' => $pendaftaranKursus->id
        ]);
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Pengesahan Pendaftaran import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
