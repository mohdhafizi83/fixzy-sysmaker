<?php

namespace App\Filament\Resources\FakultiAktifs\Pages;

use App\Filament\Resources\FakultiAktifs\FakultiAktifResource;
use Filament\Resources\Pages\CreateRecord;

class CreateFakultiAktif extends CreateRecord
{
    protected static string $resource = FakultiAktifResource::class;

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