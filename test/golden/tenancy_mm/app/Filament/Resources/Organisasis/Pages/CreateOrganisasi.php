<?php

namespace App\Filament\Resources\Organisasis\Pages;

use App\Filament\Resources\Organisasis\OrganisasiResource;
use Filament\Resources\Pages\CreateRecord;

class CreateOrganisasi extends CreateRecord
{
    protected static string $resource = OrganisasiResource::class;

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