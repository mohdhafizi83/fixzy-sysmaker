<?php

namespace App\Filament\Resources\PendingApprovals\Pages;

use App\Filament\Resources\PendingApprovals\PendingApprovalResource;
use Filament\Resources\Pages\CreateRecord;

class CreatePendingApproval extends CreateRecord
{
    protected static string $resource = PendingApprovalResource::class;

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