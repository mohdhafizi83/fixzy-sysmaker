<?php

namespace App\Filament\Resources\Pelajars\Pages;

use App\Filament\Resources\Pelajars\PelajarResource;
use Filament\Resources\Pages\CreateRecord;

class CreatePelajar extends CreateRecord
{
    protected static string $resource = PelajarResource::class;

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