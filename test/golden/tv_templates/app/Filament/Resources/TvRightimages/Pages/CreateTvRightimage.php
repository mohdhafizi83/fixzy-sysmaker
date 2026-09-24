<?php

namespace App\Filament\Resources\TvRightimages\Pages;

use App\Filament\Resources\TvRightimages\TvRightimageResource;
use Filament\Resources\Pages\CreateRecord;

class CreateTvRightimage extends CreateRecord
{
    protected static string $resource = TvRightimageResource::class;

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