<?php

namespace App\Filament\Resources\PengesahanPendaftarans\Pages;

use App\Filament\Resources\PengesahanPendaftarans\PengesahanPendaftaranResource;
use Filament\Resources\Pages\CreateRecord;

class CreatePengesahanPendaftaran extends CreateRecord
{
    protected static string $resource = PengesahanPendaftaranResource::class;

    public int $gridColumns = 2;
    
    protected function getHeaderActions(): array
    {
        return [
            $this->getCreateFormAction()
                 ->formId('form'),
            $this->getCreateAnotherFormAction()
                 ->formId('form'),
            $this->getCancelFormAction(),
        ];
    }
    
    

    protected function getFormActions(): array
    {
        return [];
    }
}