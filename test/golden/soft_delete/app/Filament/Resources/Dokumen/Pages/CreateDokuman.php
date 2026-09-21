<?php

namespace App\Filament\Resources\Dokumen\Pages;

use App\Filament\Resources\Dokumen\DokumanResource;
use Filament\Resources\Pages\CreateRecord;

class CreateDokuman extends CreateRecord
{
    protected static string $resource = DokumanResource::class;

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