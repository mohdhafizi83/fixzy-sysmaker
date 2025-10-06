<?php

namespace App\Filament\Resources\Pelajars\RelationManagers;

use App\Filament\Resources\PendaftaranKursuses\PendaftaranKursusResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class PendaftaranKursusRelationManager extends RelationManager
{
    protected static string $relationship = 'pendaftaranKursus';

    protected static ?string $relatedResource = PendaftaranKursusResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
