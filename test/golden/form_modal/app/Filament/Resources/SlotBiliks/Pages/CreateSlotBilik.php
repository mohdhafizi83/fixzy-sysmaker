<?php

namespace App\Filament\Resources\SlotBiliks\Pages;

use App\Filament\Resources\SlotBiliks\SlotBilikResource;
use Filament\Resources\Pages\CreateRecord;

class CreateSlotBilik extends CreateRecord
{
    protected static string $resource = SlotBilikResource::class;

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