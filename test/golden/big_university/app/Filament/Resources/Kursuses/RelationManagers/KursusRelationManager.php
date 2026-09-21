<?php

namespace App\Filament\Resources\Kursuses\RelationManagers;

use App\Filament\Resources\Kursuses\KursusResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class KursusRelationManager extends RelationManager
{
    protected static string $relationship = 'children';
    
    protected static ?string $relatedResource = KursusResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
