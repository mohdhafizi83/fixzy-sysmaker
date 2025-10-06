<?php

namespace App\Filament\Resources\PendaftaranKursuses\Pages;

use App\Filament\Resources\PendaftaranKursuses\PendaftaranKursusResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListPendaftaranKursuses extends ListRecords
{
    protected static string $resource = PendaftaranKursusResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
