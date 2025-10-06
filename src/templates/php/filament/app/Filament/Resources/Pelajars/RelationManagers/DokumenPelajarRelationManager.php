<?php

namespace App\Filament\Resources\Pelajars\RelationManagers;

use Filament\Actions\AssociateAction;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\DissociateAction;
use Filament\Actions\DissociateBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Textarea;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class DokumenPelajarRelationManager extends RelationManager
{
    protected static string $relationship = 'dokumenPelajar';

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Textarea::make('nama_fail')
                    ->required()
                    ->columnSpanFull(),
                Textarea::make('path_fail')
                    ->required()
                    ->columnSpanFull(),
                Textarea::make('jenis_dokumen')
                    ->default('Am')
                    ->columnSpanFull(),
                DateTimePicker::make('tarikh_muatnaik'),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('nama_fail')
            ->columns([
                TextColumn::make('tarikh_muatnaik')
                    ->dateTime()
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
