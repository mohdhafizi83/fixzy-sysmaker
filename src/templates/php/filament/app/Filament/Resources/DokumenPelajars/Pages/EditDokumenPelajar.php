<?php

namespace App\Filament\Resources\DokumenPelajars\Pages;

use App\Filament\Resources\DokumenPelajars\DokumenPelajarResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditDokumenPelajar extends EditRecord
{
    protected static string $resource = DokumenPelajarResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
