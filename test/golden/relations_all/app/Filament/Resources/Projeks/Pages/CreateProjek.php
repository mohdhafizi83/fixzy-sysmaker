<?php

namespace App\Filament\Resources\Projeks\Pages;

use App\Filament\Resources\Projeks\ProjekResource;
use Filament\Resources\Pages\CreateRecord;

class CreateProjek extends CreateRecord
{
    protected static string $resource = ProjekResource::class;

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