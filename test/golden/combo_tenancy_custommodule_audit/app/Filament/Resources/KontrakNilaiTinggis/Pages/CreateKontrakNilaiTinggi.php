<?php

namespace App\Filament\Resources\KontrakNilaiTinggis\Pages;

use App\Filament\Resources\KontrakNilaiTinggis\KontrakNilaiTinggiResource;
use Filament\Resources\Pages\CreateRecord;

class CreateKontrakNilaiTinggi extends CreateRecord
{
    protected static string $resource = KontrakNilaiTinggiResource::class;

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