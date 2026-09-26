<?php

namespace App\Filament\Resources\Kategoris\RelationManagers;

use App\Filament\Resources\Kategoris\KategoriResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\Layout\Panel;
use Filament\Tables\Table;

class KategoriRelationManager extends RelationManager
{
    protected static string $relationship = 'children';
    
    protected static ?string $relatedResource = KategoriResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ])
            ->columns([
                Panel::make([
                    TextColumn::make('id')
                    ->label('Id')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric(),
                    TextColumn::make('nama_kategori')
                    ->label('Nama Kategori')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable(),
                    TextColumn::make('parent_kategori_id')
                    ->label('Parent Kategori Id')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric()
                ])
            ])
            ->contentGrid(['md' => 2, 'xl' => 4]);
    }
}
