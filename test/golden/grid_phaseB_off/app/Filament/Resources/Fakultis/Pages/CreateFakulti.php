<?php

namespace App\Filament\Resources\Fakultis\Pages;

use App\Filament\Resources\Fakultis\FakultiResource;
use Filament\Resources\Pages\CreateRecord;

class CreateFakulti extends CreateRecord
{
    protected static string $resource = FakultiResource::class;

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