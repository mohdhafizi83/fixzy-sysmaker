<?php

namespace App\Filament\Resources\FakultiChats\Pages;

use App\Filament\Resources\FakultiChats\FakultiChatResource;
use Filament\Resources\Pages\CreateRecord;

class CreateFakultiChat extends CreateRecord
{
    protected static string $resource = FakultiChatResource::class;

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