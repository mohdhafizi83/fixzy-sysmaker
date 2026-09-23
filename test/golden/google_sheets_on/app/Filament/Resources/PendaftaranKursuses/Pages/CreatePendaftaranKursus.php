<?php

namespace App\Filament\Resources\PendaftaranKursuses\Pages;

use App\Filament\Resources\PendaftaranKursuses\PendaftaranKursusResource;
use Filament\Resources\Pages\CreateRecord;

class CreatePendaftaranKursus extends CreateRecord
{
    protected static string $resource = PendaftaranKursusResource::class;

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