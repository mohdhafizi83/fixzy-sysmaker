<?php

namespace App\Filament\Resources\LeadPipelines\Pages;

use App\Filament\Resources\LeadPipelines\LeadPipelineResource;
use Filament\Resources\Pages\CreateRecord;

class CreateLeadPipeline extends CreateRecord
{
    protected static string $resource = LeadPipelineResource::class;

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