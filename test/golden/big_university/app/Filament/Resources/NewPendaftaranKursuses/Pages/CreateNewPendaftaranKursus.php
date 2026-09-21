<?php

namespace App\Filament\Resources\NewPendaftaranKursuses\Pages;

use App\Filament\Resources\NewPendaftaranKursuses\NewPendaftaranKursusResource;
use Filament\Resources\Pages\CreateRecord;

class CreateNewPendaftaranKursus extends CreateRecord
{
    protected static string $resource = NewPendaftaranKursusResource::class;

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