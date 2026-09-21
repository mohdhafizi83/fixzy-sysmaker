<?php

namespace App\Filament\Resources\JanaBils\Pages;

use App\Filament\Resources\JanaBils\JanaBilResource;
use Filament\Resources\Pages\CreateRecord;

class CreateJanaBil extends CreateRecord
{
    protected static string $resource = JanaBilResource::class;

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