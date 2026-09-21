<?php

namespace App\Filament\Resources\CartaJualans\Pages;

use App\Filament\Resources\CartaJualans\CartaJualanResource;
use Filament\Resources\Pages\CreateRecord;

class CreateCartaJualan extends CreateRecord
{
    protected static string $resource = CartaJualanResource::class;

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