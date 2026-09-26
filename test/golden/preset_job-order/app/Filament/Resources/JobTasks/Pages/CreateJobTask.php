<?php

namespace App\Filament\Resources\JobTasks\Pages;

use App\Filament\Resources\JobTasks\JobTaskResource;
use Filament\Resources\Pages\CreateRecord;

class CreateJobTask extends CreateRecord
{
    protected static string $resource = JobTaskResource::class;

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