<?php

namespace App\Filament\Resources\Inventoris\Pages;

use App\Filament\Resources\Inventoris\InventoriResource;
use Filament\Resources\Pages\CreateRecord;

class CreateInventori extends CreateRecord
{
    protected static string $resource = InventoriResource::class;

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