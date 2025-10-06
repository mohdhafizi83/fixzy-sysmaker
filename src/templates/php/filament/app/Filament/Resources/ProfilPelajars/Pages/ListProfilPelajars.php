<?php

namespace App\Filament\Resources\ProfilPelajars\Pages;

use App\Filament\Resources\ProfilPelajars\ProfilPelajarResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListProfilPelajars extends ListRecords
{
    protected static string $resource = ProfilPelajarResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
