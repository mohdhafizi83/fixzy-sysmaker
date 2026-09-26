<?php

namespace App\Filament\Resources\SlotBiliks\RelationManagers;

use App\Filament\Resources\Tempahans\TempahanResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class TempahanRelationManager extends RelationManager
{
    protected static string $relationship = 'tempahans';
    
    protected static ?string $relatedResource = TempahanResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
