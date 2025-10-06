<?php

namespace App\Filament\Resources\PengesahanPendaftarans\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class PengesahanPendaftaransTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
            TextColumn::make('pendaftaranKursus.pelajar.nama_penuh')
                ->label('Nama Pelajar')
                ->searchable()
                ->sortable(),

            // Anda juga boleh paparkan nama kursus
            TextColumn::make('pendaftaranKursus.kursus.nama_kursus')
                ->label('Nama Kursus'),
                TextColumn::make('user.name')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('tarikh_tindakan')
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
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
