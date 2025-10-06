<?php

namespace App\Filament\Resources\Kursuses\Pages;

use App\Filament\Resources\Kursuses\KursusResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditKursus extends EditRecord
{
    protected static string $resource = KursusResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
