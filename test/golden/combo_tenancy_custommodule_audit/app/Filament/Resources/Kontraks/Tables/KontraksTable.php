<?php

namespace App\Filament\Resources\Kontraks\Tables;



use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ForceDeleteAction;
use Filament\Actions\RestoreAction;
use Filament\Tables\Table;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TrashedFilter;
use Illuminate\Contracts\View\View;


class KontraksTable
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
                TextColumn::make('no_rujukan')
                    ->label('No Rujukan')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('nilai')
                    ->label('Nilai')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric(),
                TextColumn::make('created_by')
                    ->label('Created By')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric(),
                TextColumn::make('updated_by')
                    ->label('Updated By')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric(),
                TextColumn::make('deleted_by')
                    ->label('Deleted By')
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