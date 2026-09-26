<?php

namespace App\Filament\Resources\Tugases\Pages;

use App\Filament\Resources\Tugases\TugasResource;
use Filament\Resources\Pages\CreateRecord;

class CreateTugas extends CreateRecord
{
    protected static string $resource = TugasResource::class;

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