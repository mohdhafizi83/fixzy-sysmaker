<?php

namespace App\Filament\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Approval trail relation manager (Fixzy SysMaker generated code).
 *
 * Read-only history of approval transitions shown on resources with
 * the Approvals module enabled.
 */
class ApprovalHistoryRelationManager extends RelationManager
{
    protected static string $relationship = 'approvalHistories';

    protected static ?string $title = 'Approval History';

    /** Read-only manager (Filament v5: isReadOnly lives on the manager, not the Table). */
    public function isReadOnly(): bool
    {
        return true;
    }

    public function form(Schema $schema): Schema
    {
        return $schema->components([]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('to_status')
            ->columns([
                Tables\Columns\TextColumn::make('from_status')
                    ->label('From')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => ucfirst(str_replace('_', ' ', $state))),
                Tables\Columns\TextColumn::make('to_status')
                    ->label('To')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => ucfirst(str_replace('_', ' ', $state))),
                Tables\Columns\TextColumn::make('user.name')
                    ->label('By')
                    ->default('System'),
                Tables\Columns\TextColumn::make('comment')
                    ->label('Comment')
                    ->wrap()
                    ->limit(120)
                    ->default('—'),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('When')
                    ->dateTime()
                    ->sortable(),
            ])
            ->defaultSort('created_at', 'desc')
            ->headerActions([])
            ->actions([])
            ->bulkActions([]);
    }
}
