<?php

namespace App\Filament\Resources\Tickets\RelationManagers;

use App\Filament\Resources\TicketReplies\TicketReplyResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class TicketReplyRelationManager extends RelationManager
{
    protected static string $relationship = 'ticketReplies';
    
    protected static ?string $relatedResource = TicketReplyResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ]);
    }
}
