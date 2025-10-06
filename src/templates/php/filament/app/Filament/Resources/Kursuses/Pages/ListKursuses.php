<?php

namespace App\Filament\Resources\Kursuses\Pages;

use App\Filament\Resources\Kursuses\KursusResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListKursuses extends ListRecords
{
    protected static string $resource = KursusResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
