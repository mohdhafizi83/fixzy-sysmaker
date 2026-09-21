<?php

namespace App\Filament\Resources\Asets\Pages;

use App\Filament\Resources\Asets\AsetResource;
use Filament\Resources\Pages\CreateRecord;

class CreateAset extends CreateRecord
{
    protected static string $resource = AsetResource::class;

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