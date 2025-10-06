<?php

namespace App\Filament\Resources\NewPendaftaranKursuses\Pages;

use App\Filament\Resources\NewPendaftaranKursuses\NewPendaftaranKursusResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditNewPendaftaranKursus extends EditRecord
{
    protected static string $resource = NewPendaftaranKursusResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
