<?php

namespace App\Filament\Resources\Fakultis\RelationManagers;

use App\Filament\Resources\Pelajars\PelajarResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class PelajarRelationManager extends RelationManager
{
    protected static string $relationship = 'pelajars';
    
    protected static ?string $relatedResource = PelajarResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
