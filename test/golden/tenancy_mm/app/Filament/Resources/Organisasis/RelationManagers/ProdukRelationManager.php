<?php

namespace App\Filament\Resources\Organisasis\RelationManagers;

use App\Filament\Resources\Produks\ProdukResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class ProdukRelationManager extends RelationManager
{
    protected static string $relationship = 'produks';
    
    protected static ?string $relatedResource = ProdukResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
