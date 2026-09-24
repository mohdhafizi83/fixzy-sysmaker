<?php

namespace App\Filament\Resources\TvLeftimages\Pages;

use App\Filament\Resources\TvLeftimages\TvLeftimageResource;
use Filament\Resources\Pages\CreateRecord;

class CreateTvLeftimage extends CreateRecord
{
    protected static string $resource = TvLeftimageResource::class;

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