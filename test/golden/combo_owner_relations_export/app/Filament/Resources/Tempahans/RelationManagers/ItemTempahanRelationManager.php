<?php

namespace App\Filament\Resources\Tempahans\RelationManagers;

use App\Filament\Resources\ItemTempahans\ItemTempahanResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class ItemTempahanRelationManager extends RelationManager
{
    protected static string $relationship = 'itemTempahans';
    
    protected static ?string $relatedResource = ItemTempahanResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
