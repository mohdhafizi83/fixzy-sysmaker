<?php

namespace App\Filament\Resources\Inventoris\Tables;



use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ForceDeleteAction;
use Filament\Actions\RestoreAction;
use Filament\Tables\Table;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TrashedFilter;
use Illuminate\Contracts\View\View;


class InventorisTable
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
                TextColumn::make('item_name')
                    ->label('Item Name')
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
                TextColumn::make('harga_seunit')
                    ->label('Harga Seunit')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric()
            ])
            ->when((bool) request()->query('print'), fn (Table $table) => $table->paginated(false),)
            ->filters([
                TrashedFilter::make(),
            ])
            ->recordActions([

                   
                    
                
                
                ForceDeleteAction::make(),
                RestoreAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                DeleteBulkAction::make(),
            ]),
            ]);
    }
}