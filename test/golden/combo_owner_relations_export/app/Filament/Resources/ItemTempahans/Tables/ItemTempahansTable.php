<?php

namespace App\Filament\Resources\ItemTempahans\Tables;



use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Tables\Table;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Contracts\View\View;


class ItemTempahansTable
{
    public static function configure(Table $table): Table
    {
        return $table
            
            
            
            
            
            ->description('')
            ->columns([
                TextColumn::make('id')
                    ->label('Id')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric(),
                TextColumn::make('tempahan_id')
                    ->label('Tempahan Id')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric(),
                TextColumn::make('produk')
                    ->label('Produk')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('kuantiti')
                    ->label('Kuantiti')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric(),
                TextColumn::make('harga')
                    ->label('Harga')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric()
            ])
            ->when((bool) request()->query('print'), fn (Table $table) => $table->paginated(false),)
            ->filters([
                
            ])
            ->recordActions([

                   
                    
                
                
                
                
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                DeleteBulkAction::make(),
            ]),
            ]);
    }
}