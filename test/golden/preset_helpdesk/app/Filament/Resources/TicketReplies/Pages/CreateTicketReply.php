<?php

namespace App\Filament\Resources\TicketReplies\Pages;

use App\Filament\Resources\TicketReplies\TicketReplyResource;
use Filament\Resources\Pages\CreateRecord;

class CreateTicketReply extends CreateRecord
{
    protected static string $resource = TicketReplyResource::class;

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