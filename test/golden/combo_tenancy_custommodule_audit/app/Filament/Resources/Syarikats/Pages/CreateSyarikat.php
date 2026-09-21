<?php

namespace App\Filament\Resources\Syarikats\Pages;

use App\Filament\Resources\Syarikats\SyarikatResource;
use Filament\Resources\Pages\CreateRecord;

class CreateSyarikat extends CreateRecord
{
    protected static string $resource = SyarikatResource::class;

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