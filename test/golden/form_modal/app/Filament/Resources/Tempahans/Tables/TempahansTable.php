<?php

namespace App\Filament\Resources\Tempahans\Tables;



use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ForceDeleteAction;
use Filament\Actions\RestoreAction;
use Filament\Tables\Table;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TrashedFilter;
use Filament\Support\Enums\TextSize;
use Illuminate\Contracts\View\View;


class TempahansTable
{
    public static function configure(Table $table): Table
    {
        return $table
            
            
            
            
            
            ->description('')
            ->columns([
                TextColumn::make('nama')
                    ->label('Nama')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->color('success')
                    ->size(TextSize::Medium)
                    ->searchable()
                    ->toggleable()
                    ->alignCenter(),
                TextColumn::make('bilik.no_bilik')
                    ->label('Room Number')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->color('success')
                    ->size(TextSize::Medium)
                    ->searchable()
                    ->toggleable()
                    ->alignCenter()
                    ->numeric(),
                TextColumn::make('slotBilik.slot_label')
                    ->label('Slot')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->color('success')
                    ->size(TextSize::Medium)
                    ->searchable()
                    ->toggleable()
                    ->alignCenter()
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