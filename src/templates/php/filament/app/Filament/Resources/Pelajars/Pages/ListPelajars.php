<?php

namespace App\Filament\Resources\Pelajars\Pages;

use App\Filament\Resources\Pelajars\PelajarResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListPelajars extends ListRecords
{
    protected static string $resource = PelajarResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
