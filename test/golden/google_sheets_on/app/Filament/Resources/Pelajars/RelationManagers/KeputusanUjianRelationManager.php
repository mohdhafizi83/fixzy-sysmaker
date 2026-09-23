<?php

namespace App\Filament\Resources\Pelajars\RelationManagers;

use App\Filament\Resources\KeputusanUjians\KeputusanUjianResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class KeputusanUjianRelationManager extends RelationManager
{
    protected static string $relationship = 'keputusanUjians';
    
    protected static ?string $relatedResource = KeputusanUjianResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
