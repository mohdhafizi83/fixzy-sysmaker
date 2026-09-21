<?php

namespace App\Filament\Resources\ItemTempahans\Pages;

use App\Filament\Resources\ItemTempahans\ItemTempahanResource;
use Filament\Resources\Pages\CreateRecord;

class CreateItemTempahan extends CreateRecord
{
    protected static string $resource = ItemTempahanResource::class;

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
    
    
    public function getLayout(): string
    {
        if (session('is_in_iframe')) {
            return 'filament.layouts.custom-iframe-layout';
        }
        
        return parent::getLayout();
    }


    protected function getFormActions(): array
    {
        return [];
    }
}