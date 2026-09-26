<?php

namespace App\Filament\Resources\Biliks\Pages;

use App\Filament\Resources\Biliks\BilikResource;
use Filament\Resources\Pages\CreateRecord;

class CreateBilik extends CreateRecord
{
    protected static string $resource = BilikResource::class;

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