<?php

namespace App\Filament\Resources\FakultiRingkas\Pages;

use App\Filament\Resources\FakultiRingkas\FakultiRingkaResource;
use Filament\Resources\Pages\CreateRecord;

class CreateFakultiRingka extends CreateRecord
{
    protected static string $resource = FakultiRingkaResource::class;

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