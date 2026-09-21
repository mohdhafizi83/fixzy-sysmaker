<?php

namespace App\Filament\Resources\ProfilPelajars\Pages;

use App\Filament\Resources\ProfilPelajars\ProfilPelajarResource;
use Filament\Resources\Pages\CreateRecord;

class CreateProfilPelajar extends CreateRecord
{
    protected static string $resource = ProfilPelajarResource::class;

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