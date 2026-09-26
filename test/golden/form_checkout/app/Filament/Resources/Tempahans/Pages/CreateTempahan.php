<?php

namespace App\Filament\Resources\Tempahans\Pages;

use App\Filament\Resources\Tempahans\TempahanResource;
use Filament\Resources\Pages\CreateRecord;

class CreateTempahan extends CreateRecord
{
    protected static string $resource = TempahanResource::class;

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