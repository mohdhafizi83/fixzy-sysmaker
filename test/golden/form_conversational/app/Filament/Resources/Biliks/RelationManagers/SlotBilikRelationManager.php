<?php

namespace App\Filament\Resources\Biliks\RelationManagers;

use App\Filament\Resources\SlotBiliks\SlotBilikResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class SlotBilikRelationManager extends RelationManager
{
    protected static string $relationship = 'slotBiliks';
    
    protected static ?string $relatedResource = SlotBilikResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
