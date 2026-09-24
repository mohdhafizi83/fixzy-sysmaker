<?php

namespace App\Filament\Resources\TvVertical2s\Pages;

use App\Filament\Resources\TvVertical2s\TvVertical2Resource;
use Filament\Resources\Pages\CreateRecord;

class CreateTvVertical2 extends CreateRecord
{
    protected static string $resource = TvVertical2Resource::class;

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