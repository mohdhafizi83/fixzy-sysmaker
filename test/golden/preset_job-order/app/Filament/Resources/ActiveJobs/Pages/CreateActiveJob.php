<?php

namespace App\Filament\Resources\ActiveJobs\Pages;

use App\Filament\Resources\ActiveJobs\ActiveJobResource;
use Filament\Resources\Pages\CreateRecord;

class CreateActiveJob extends CreateRecord
{
    protected static string $resource = ActiveJobResource::class;

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