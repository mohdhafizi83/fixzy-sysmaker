<?php

namespace App\Filament\Resources\Fakultis\Tables;



use App\Models\Fakulti;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ForceDeleteAction;
use Filament\Actions\RestoreAction;
use Filament\Tables\Table;
use Filament\Tables\Filters\TrashedFilter;
use Filament\Tables\Columns\Layout\Panel;
use Filament\Tables\Columns\TextInputColumn;
use Filament\Tables\Columns\ToggleColumn;
use Illuminate\Contracts\View\View;


class FakultisTable
{
    public static function configure(Table $table): Table
    {
        return $table
            
            
            ->defaultPaginationPageOption(25)->paginationPageOptions([10, 25, 50])
            
            
            
            ->extraAttributes(['class' => 'fixzy-sticky-header fixzy-grid-compact'])
            ->description('')
            ->contentGrid((request()->query('view', 'table')) === 'card' ? ['md' => 2, 'xl' => 3] : null)
            ->columns((request()->query('view', 'table')) === 'card' ? [Panel::make([
                    TextInputColumn::make('nama_fakulti')
                    ->label('Nama Fakulti')
                    ->rules(['max:255'])
                    ->updateStateUsing(function ($record, $state) {
                    if (! auth()->user()?->can('update', $record)) {
                        abort(403);
                    }
                    if (is_null($state)) {
                        $record->nama_fakulti = null;
                    } else {
                        $record->nama_fakulti = $state;
                    }
                    $record->save();
                    return $record;
                }),
                    ToggleColumn::make('is_aktif')
                    ->label('Aktif')
                    ->rules(['boolean'])
                    ->updateStateUsing(function ($record, $state) {
                    if (! auth()->user()?->can('update', $record)) {
                        abort(403);
                    }
                    if (is_null($state)) {
                        $record->is_aktif = null;
                    } else {
                        $record->is_aktif = $state;
                    }
                    $record->save();
                    return $record;
                })
                ])] : [
                    TextInputColumn::make('nama_fakulti')
                    ->label('Nama Fakulti')
                    ->rules(['max:255'])
                    ->updateStateUsing(function ($record, $state) {
                    if (! auth()->user()?->can('update', $record)) {
                        abort(403);
                    }
                    if (is_null($state)) {
                        $record->nama_fakulti = null;
                    } else {
                        $record->nama_fakulti = $state;
                    }
                    $record->save();
                    return $record;
                }),
                    ToggleColumn::make('is_aktif')
                    ->label('Aktif')
                    ->rules(['boolean'])
                    ->updateStateUsing(function ($record, $state) {
                    if (! auth()->user()?->can('update', $record)) {
                        abort(403);
                    }
                    if (is_null($state)) {
                        $record->is_aktif = null;
                    } else {
                        $record->is_aktif = $state;
                    }
                    $record->save();
                    return $record;
                })
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
                Action::make('switchToTable')->link()->label('Table view')->url(fn (): string => request()->fullUrlWithQuery(['view' => 'table']))->hidden(fn (): bool => (request()->query('view', 'table')) === 'table'),
                Action::make('switchToCard')->link()->label('Card view')->url(fn (): string => request()->fullUrlWithQuery(['view' => 'card']))->hidden(fn (): bool => (request()->query('view', 'table')) === 'card'),
                BulkActionGroup::make([
                DeleteBulkAction::make(),
            ]),
            ]);
    }
}