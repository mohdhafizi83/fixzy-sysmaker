<?php

namespace App\Filament\Resources\ProfilPelajars\Pages;

use App\Filament\Resources\ProfilPelajars\ProfilPelajarResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditProfilPelajar extends EditRecord
{
    protected static string $resource = ProfilPelajarResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
