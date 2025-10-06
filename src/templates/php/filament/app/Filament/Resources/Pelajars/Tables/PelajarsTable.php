<?php

namespace App\Filament\Resources\Pelajars\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

use Filament\Actions\DeleteAction;
use Filament\Actions\ForceDeleteAction;
use Filament\Actions\RestoreAction;
use Filament\Tables\Filters\TrashedFilter;

class PelajarsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('nama_penuh')
					->sortable()
                    ->searchable(),
                TextColumn::make('no_matrik')
					->sortable()
                    ->searchable(),
                TextColumn::make('email')
                    ->label('Email address')
					->sortable()
                    ->searchable(),
                TextColumn::make('tarikh_daftar')
                    ->date()
                    ->sortable()
					->searchable(),
                TextColumn::make('gambar_profil')
                    ->searchable(),
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
                TrashedFilter::make(),
            ])
            ->recordActions([
                EditAction::make(),
				DeleteAction::make(),
				ForceDeleteAction::make(), // Untuk padam selamanya
				RestoreAction::make(),     // Untuk kembalikan data
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
