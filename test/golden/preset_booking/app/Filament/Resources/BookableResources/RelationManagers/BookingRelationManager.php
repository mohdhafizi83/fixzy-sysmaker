<?php

namespace App\Filament\Resources\BookableResources\RelationManagers;

use App\Filament\Resources\Bookings\BookingResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class BookingRelationManager extends RelationManager
{
    protected static string $relationship = 'bookings';
    
    protected static ?string $relatedResource = BookingResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
