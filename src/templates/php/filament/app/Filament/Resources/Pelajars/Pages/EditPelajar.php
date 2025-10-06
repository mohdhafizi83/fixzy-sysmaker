<?php

namespace App\Filament\Resources\Pelajars\Pages;

use App\Filament\Resources\Pelajars\PelajarResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditPelajar extends EditRecord
{
    protected static string $resource = PelajarResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
