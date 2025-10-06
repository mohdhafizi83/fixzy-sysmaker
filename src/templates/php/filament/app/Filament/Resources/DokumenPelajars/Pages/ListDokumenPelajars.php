<?php

namespace App\Filament\Resources\DokumenPelajars\Pages;

use App\Filament\Resources\DokumenPelajars\DokumenPelajarResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListDokumenPelajars extends ListRecords
{
    protected static string $resource = DokumenPelajarResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
