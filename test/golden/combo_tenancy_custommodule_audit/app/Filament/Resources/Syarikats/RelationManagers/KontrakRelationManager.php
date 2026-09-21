<?php

namespace App\Filament\Resources\Syarikats\RelationManagers;

use App\Filament\Resources\Kontraks\KontrakResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class KontrakRelationManager extends RelationManager
{
    protected static string $relationship = 'kontraks';
    
    protected static ?string $relatedResource = KontrakResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
