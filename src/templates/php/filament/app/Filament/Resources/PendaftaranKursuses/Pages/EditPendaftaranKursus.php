<?php

namespace App\Filament\Resources\PendaftaranKursuses\Pages;

use App\Filament\Resources\PendaftaranKursuses\PendaftaranKursusResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditPendaftaranKursus extends EditRecord
{
    protected static string $resource = PendaftaranKursusResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
