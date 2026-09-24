<?php

namespace App\Filament\Resources\TvVertical1s\Pages;

use App\Filament\Resources\TvVertical1s\TvVertical1Resource;
use Filament\Resources\Pages\CreateRecord;

class CreateTvVertical1 extends CreateRecord
{
    protected static string $resource = TvVertical1Resource::class;

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