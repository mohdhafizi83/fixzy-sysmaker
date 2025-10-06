<?php

namespace App\Filament\Resources\Kursuses\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class KursusesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('nama_kursus')
                    ->searchable(),
                TextColumn::make('kod_kursus')
                    ->searchable(),
                TextColumn::make('jam_kredit')
                    ->numeric()
                    ->sortable(),
				TextColumn::make('prasyarat.nama_kursus') // <-- Guna nama relationship yang baru
					->label('Prasyarat Kursus') // <-- Label yang lebih sesuai
					->searchable()
					->sortable(),
				TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                //
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
