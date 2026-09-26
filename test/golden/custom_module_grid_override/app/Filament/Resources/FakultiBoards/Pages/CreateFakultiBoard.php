<?php

namespace App\Filament\Resources\FakultiBoards\Pages;

use App\Filament\Resources\FakultiBoards\FakultiBoardResource;
use Filament\Resources\Pages\CreateRecord;

class CreateFakultiBoard extends CreateRecord
{
    protected static string $resource = FakultiBoardResource::class;

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