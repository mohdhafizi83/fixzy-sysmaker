<?php

namespace App\Filament\Resources\PengesahanPendaftarans\Pages;

use App\Filament\Resources\PengesahanPendaftarans\PengesahanPendaftaranResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditPengesahanPendaftaran extends EditRecord
{
    protected static string $resource = PengesahanPendaftaranResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
