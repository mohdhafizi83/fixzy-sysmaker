<?php

namespace App\Filament\Resources\SemuaFields\Pages;

use App\Filament\Resources\SemuaFields\SemuaFieldResource;
use Filament\Resources\Pages\CreateRecord;

class CreateSemuaField extends CreateRecord
{
    protected static string $resource = SemuaFieldResource::class;

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