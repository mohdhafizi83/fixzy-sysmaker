<?php

namespace App\Filament\Resources\TvCards\Pages;

use App\Filament\Resources\TvCards\TvCardResource;
use Filament\Resources\Pages\CreateRecord;

class CreateTvCard extends CreateRecord
{
    protected static string $resource = TvCardResource::class;

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