<?php

namespace App\Filament\Resources\UrgentTickets\Pages;

use App\Filament\Resources\UrgentTickets\UrgentTicketResource;
use Filament\Resources\Pages\CreateRecord;

class CreateUrgentTicket extends CreateRecord
{
    protected static string $resource = UrgentTicketResource::class;

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