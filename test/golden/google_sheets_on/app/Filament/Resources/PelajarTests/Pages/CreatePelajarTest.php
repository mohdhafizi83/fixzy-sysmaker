<?php

namespace App\Filament\Resources\PelajarTests\Pages;

use App\Filament\Resources\PelajarTests\PelajarTestResource;
use Filament\Resources\Pages\CreateRecord;

class CreatePelajarTest extends CreateRecord
{
    protected static string $resource = PelajarTestResource::class;

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