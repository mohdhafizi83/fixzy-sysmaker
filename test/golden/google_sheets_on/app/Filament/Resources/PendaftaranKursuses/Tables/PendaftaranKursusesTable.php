<?php

namespace App\Filament\Resources\PendaftaranKursuses\Tables;



use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ForceDeleteAction;
use Filament\Actions\RestoreAction;
use Filament\Tables\Table;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TrashedFilter;
use Filament\Tables\Columns\Summarizers\Count;
use Illuminate\Contracts\View\View;


class PendaftaranKursusesTable
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
                TextColumn::make('pelajar.nama_penuh')
                    ->label('Pelajar Id')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric(),
                TextColumn::make('kursus.nama_kursus')
                    ->label('Kursus Id')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric(),
                TextColumn::make('tarikh_pendaftaran')
                    ->label('Tarikh Pendaftaran')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->dateTime('d F Y h:i A'),
                TextColumn::make('gred')
                    ->label('Gred')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable(),
                IconColumn::make('dokumen_lengkap')
                    ->label('Dokumen Lengkap')
                    ->boolean()
                    ->searchable()
                    ->wrapHeader()
                    ->toggleable()
                    ->summarize([
                        Count::make()->icons()
                    ]),
                TextColumn::make('created_at')
                    ->label('Created At')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->dateTime('d F Y h:i A'),
                TextColumn::make('updated_at')
                    ->label('Updated At')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->dateTime('d F Y h:i A'),
                TextColumn::make('deleted_at')
                    ->label('Deleted At')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->dateTime('d F Y h:i A')
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