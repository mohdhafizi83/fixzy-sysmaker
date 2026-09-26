<?php

namespace App\Filament\Resources\Jobs\RelationManagers;

use App\Filament\Resources\JobTasks\JobTaskResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class JobTaskRelationManager extends RelationManager
{
    protected static string $relationship = 'jobTasks';
    
    protected static ?string $relatedResource = JobTaskResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
