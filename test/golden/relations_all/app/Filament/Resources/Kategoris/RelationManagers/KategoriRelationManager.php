<?php

namespace App\Filament\Resources\Kategoris\RelationManagers;

use App\Filament\Resources\Kategoris\KategoriResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class KategoriRelationManager extends RelationManager
{
    protected static string $relationship = 'children';
    
    protected static ?string $relatedResource = KategoriResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
