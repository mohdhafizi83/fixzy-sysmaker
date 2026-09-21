<?php

namespace App\Filament\Resources\Projeks\RelationManagers;

use App\Filament\Resources\Tugases\TugasResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class TugasRelationManager extends RelationManager
{
    protected static string $relationship = 'tugases';
    
    protected static ?string $relatedResource = TugasResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
