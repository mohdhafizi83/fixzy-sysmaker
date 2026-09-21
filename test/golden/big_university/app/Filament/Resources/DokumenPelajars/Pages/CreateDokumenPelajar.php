<?php

namespace App\Filament\Resources\DokumenPelajars\Pages;

use App\Filament\Resources\DokumenPelajars\DokumenPelajarResource;
use Filament\Resources\Pages\CreateRecord;

class CreateDokumenPelajar extends CreateRecord
{
    protected static string $resource = DokumenPelajarResource::class;

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