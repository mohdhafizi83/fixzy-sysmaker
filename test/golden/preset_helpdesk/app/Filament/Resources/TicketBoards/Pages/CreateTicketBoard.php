<?php

namespace App\Filament\Resources\TicketBoards\Pages;

use App\Filament\Resources\TicketBoards\TicketBoardResource;
use Filament\Resources\Pages\CreateRecord;

class CreateTicketBoard extends CreateRecord
{
    protected static string $resource = TicketBoardResource::class;

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