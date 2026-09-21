<?php

namespace App\Filament\Resources\Pelanggans\Tables;



use App\Models\Pelanggan;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Tables\Table;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Contracts\View\View;


class PelanggansTable
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
                TextColumn::make('nama_pelanggan')
                    ->label('Nama Pelanggan')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('emel')
                    ->label('Emel')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
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