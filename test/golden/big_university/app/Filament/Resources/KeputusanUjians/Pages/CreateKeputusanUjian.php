<?php

namespace App\Filament\Resources\KeputusanUjians\Pages;

use App\Filament\Resources\KeputusanUjians\KeputusanUjianResource;
use Filament\Resources\Pages\CreateRecord;

class CreateKeputusanUjian extends CreateRecord
{
    protected static string $resource = KeputusanUjianResource::class;

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