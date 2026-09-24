<?php

namespace App\Filament\Resources\TvCards\Tables;



use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ForceDeleteAction;
use Filament\Actions\RestoreAction;
use Filament\Tables\Table;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TrashedFilter;
use Filament\Tables\Columns\Layout\Panel;
use Filament\Support\Enums\TextSize;
use Illuminate\Contracts\View\View;


class TvCardsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            
            
            ->contentGrid(['md' => 1, 'xl' => 4])
            
            
            
            ->description('')
            ->columns([
                Panel::make([
                    TextColumn::make('nama_fakulti')
                    ->label('Nama Fakulti')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->color('success')
                    ->size(TextSize::Medium)
                    ->searchable()
                    ->toggleable()
                    ->alignCenter(),
                    ImageColumn::make('gambar')
                    ->label('Gambar')
                    ->circular()
                    ->imageWidth(60)
                    ->toggleable()
                ])
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