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
    
    
    public function getLayout(): string
    {
        if (session('is_in_iframe') || request()->has('iframe')) {
            return 'filament.layouts.custom-iframe-layout';
        }
        
        return parent::getLayout();
    }


    protected function getFormActions(): array
    {
        return [];
    }
}