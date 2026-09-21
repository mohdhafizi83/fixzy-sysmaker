<?php

namespace App\Filament\Resources\Kontraks\Pages;

use App\Filament\Resources\Kontraks\KontrakResource;
use Filament\Resources\Pages\CreateRecord;

class CreateKontrak extends CreateRecord
{
    protected static string $resource = KontrakResource::class;

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