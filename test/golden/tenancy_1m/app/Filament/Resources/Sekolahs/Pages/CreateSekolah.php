<?php

namespace App\Filament\Resources\Sekolahs\Pages;

use App\Filament\Resources\Sekolahs\SekolahResource;
use Filament\Resources\Pages\CreateRecord;

class CreateSekolah extends CreateRecord
{
    protected static string $resource = SekolahResource::class;

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