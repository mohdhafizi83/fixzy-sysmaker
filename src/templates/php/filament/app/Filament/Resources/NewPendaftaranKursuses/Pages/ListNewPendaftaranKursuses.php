<?php

namespace App\Filament\Resources\NewPendaftaranKursuses\Pages;

use App\Filament\Resources\NewPendaftaranKursuses\NewPendaftaranKursusResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListNewPendaftaranKursuses extends ListRecords
{
    protected static string $resource = NewPendaftaranKursusResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
