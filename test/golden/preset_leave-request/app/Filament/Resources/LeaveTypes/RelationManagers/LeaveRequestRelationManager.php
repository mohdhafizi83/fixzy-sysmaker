<?php

namespace App\Filament\Resources\LeaveTypes\RelationManagers;

use App\Filament\Resources\LeaveRequests\LeaveRequestResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class LeaveRequestRelationManager extends RelationManager
{
    protected static string $relationship = 'leaveRequests';
    
    protected static ?string $relatedResource = LeaveRequestResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
