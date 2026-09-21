<?php

namespace App\Filament\Resources\LaporanHarians\Pages;

use App\Filament\Resources\LaporanHarians\LaporanHarianResource;
use Filament\Resources\Pages\CreateRecord;

class CreateLaporanHarian extends CreateRecord
{
    protected static string $resource = LaporanHarianResource::class;

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