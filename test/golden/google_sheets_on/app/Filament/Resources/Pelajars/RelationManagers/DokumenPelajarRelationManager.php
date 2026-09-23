<?php

namespace App\Filament\Resources\Pelajars\RelationManagers;

use App\Filament\Resources\DokumenPelajars\DokumenPelajarResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class DokumenPelajarRelationManager extends RelationManager
{
    protected static string $relationship = 'dokumenPelajars';
    
    protected static ?string $relatedResource = DokumenPelajarResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
