<?php

namespace App\Filament\Resources\Pelajars\RelationManagers;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ProfilPelajarRelationManager extends RelationManager
{
    protected static string $relationship = 'profilPelajar';

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('pelajar_id')
                    ->required()
                    ->numeric(),
                Textarea::make('alamat')
                    ->columnSpanFull(),
                TextInput::make('no_telefon')
                    ->tel(),
                DatePicker::make('tarikh_lahir'),
                Textarea::make('info_kecemasan')
                    ->columnSpanFull(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('alamat')
            ->columns([
                TextColumn::make('pelajar_id')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('no_telefon')
                    ->searchable(),
                TextColumn::make('tarikh_lahir')
                    ->date()
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
            ->headerActions([
                CreateAction::make(),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
