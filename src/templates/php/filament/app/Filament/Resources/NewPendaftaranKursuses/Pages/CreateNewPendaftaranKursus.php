<?php

namespace App\Filament\Resources\NewPendaftaranKursuses\Pages;

use App\Filament\Resources\NewPendaftaranKursuses\NewPendaftaranKursusResource;
use Filament\Resources\Pages\CreateRecord;

class CreateNewPendaftaranKursus extends CreateRecord
{
    protected static string $resource = NewPendaftaranKursusResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        // Tetapkan nilai is_pending secara automatik
        $data['status'] = 'Baru';
 
        return $data;
    }
}
