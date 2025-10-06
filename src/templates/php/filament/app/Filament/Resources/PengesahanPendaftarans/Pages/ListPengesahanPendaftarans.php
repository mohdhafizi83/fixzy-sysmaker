<?php

namespace App\Filament\Resources\PengesahanPendaftarans\Pages;

use App\Filament\Resources\PengesahanPendaftarans\PengesahanPendaftaranResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListPengesahanPendaftarans extends ListRecords
{
    protected static string $resource = PengesahanPendaftaranResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
