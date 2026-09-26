<?php

namespace App\Filament\Resources\BookableResources\Pages;

use App\Filament\Resources\BookableResources\BookableResourceResource;
use Filament\Resources\Pages\CreateRecord;

class CreateBookableResource extends CreateRecord
{
    protected static string $resource = BookableResourceResource::class;

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