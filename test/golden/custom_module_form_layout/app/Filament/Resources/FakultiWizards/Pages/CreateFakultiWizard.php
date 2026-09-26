<?php

namespace App\Filament\Resources\FakultiWizards\Pages;

use App\Filament\Resources\FakultiWizards\FakultiWizardResource;
use Filament\Resources\Pages\CreateRecord;

class CreateFakultiWizard extends CreateRecord
{
    protected static string $resource = FakultiWizardResource::class;

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