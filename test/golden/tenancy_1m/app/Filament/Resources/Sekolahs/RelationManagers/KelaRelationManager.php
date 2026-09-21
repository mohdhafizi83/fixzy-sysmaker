<?php

namespace App\Filament\Resources\Sekolahs\RelationManagers;

use App\Filament\Resources\Kelas\KelaResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class KelaRelationManager extends RelationManager
{
    protected static string $relationship = 'kelas';
    
    protected static ?string $relatedResource = KelaResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
