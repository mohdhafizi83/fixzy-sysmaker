<?php

namespace App\Filament\Resources\PendaftaranKursuses\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Table;

use Filament\Tables\Filters\Filter;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\DatePicker;
use Illuminate\Database\Eloquent\Builder;

class PendaftaranKursusesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('pelajar.nama_penuh')
                    ->numeric()
                    ->sortable()
					->searchable(),
                TextColumn::make('kursus.nama_kursus')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('tarikh_pendaftaran')
                    ->dateTime()
                    ->sortable(),
                TextColumn::make('gred')
                    ->searchable(),
                TextColumn::make('status')
					->sortable()
                    ->searchable(),
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
            Filter::make('carian_lanjutan')
                ->form([
                    Select::make('kursus_id')
                        ->label('Kursus')
                        ->relationship('kursus', 'nama_kursus')
                        ->searchable()
                        ->preload(),

                    Select::make('status')
                        ->label('Status Pendaftaran')
                        ->options([
                            'Baru' => 'Baru',
                            'Disahkan' => 'Disahkan',
                            'Ditolak' => 'Ditolak',
                        ])
						->multiple(),
                    
                    DatePicker::make('tarikh_mula')
                        ->label('Didaftar Selepas Tarikh'),
                    
                    DatePicker::make('tarikh_akhir')
                        ->label('Didaftar Sebelum Tarikh'),
                ])
                ->query(function (Builder $query, array $data): Builder {
                    return $query
                        ->when(
                            $data['kursus_id'],
                            fn (Builder $query, $kursusId): Builder => $query->where('kursus_id', $kursusId)
                        )
                        ->when(
                            $data['status'],
							//TUKAR KEPADA whereIn() UNTUK MENGENDALIKAN ARRAY
                            fn (Builder $query, $status): Builder => $query->whereIn('status', $status)
                        )
                        ->when(
                            $data['tarikh_mula'],
                            fn (Builder $query, $tarikh): Builder => $query->whereDate('tarikh_pendaftaran', '>=', $tarikh)
                        )
                        ->when(
                            $data['tarikh_akhir'],
                            fn (Builder $query, $tarikh): Builder => $query->whereDate('tarikh_pendaftaran', '<=', $tarikh)
                        );
                }),
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
