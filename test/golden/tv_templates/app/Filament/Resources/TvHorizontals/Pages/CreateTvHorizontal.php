<?php

namespace App\Filament\Resources\TvHorizontals\Pages;

use App\Filament\Resources\TvHorizontals\TvHorizontalResource;
use Filament\Resources\Pages\CreateRecord;

class CreateTvHorizontal extends CreateRecord
{
    protected static string $resource = TvHorizontalResource::class;

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