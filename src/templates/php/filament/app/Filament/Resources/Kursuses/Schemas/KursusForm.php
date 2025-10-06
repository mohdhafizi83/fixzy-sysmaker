<?php

namespace App\Filament\Resources\Kursuses\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Select;
use App\Models\Kursus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Filament\Schemas\Schema;

class KursusForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('nama_kursus')
                    ->required()
					->markAsRequired()
					->autofocus()
					->helperText('Your course name, without code.'),
                TextInput::make('kod_kursus')
                    ->required()
					->markAsRequired(),
                Textarea::make('deskripsi')
                    ->columnSpanFull(),
                TextInput::make('jam_kredit')
                    ->required()
					->markAsRequired()
                    ->numeric()
                    ->default(3),
            Select::make('prasyarat_kursus_id')
                ->label('Prasyarat Kursus')
                ->searchable()
                ->preload()
                ->getOptionLabelFromRecordUsing(fn (Model $record) => "{$record->kod_kursus} - {$record->nama_kursus}")
                // DIBAIKI: Logik query diletakkan di dalam `relationship()`
                ->relationship(
                    name: 'prasyarat',
                    titleAttribute: 'nama_kursus',
                    modifyQueryUsing: fn (Builder $query, ?Model $record) => $query->where('id_kursus', '!=', $record?->id_kursus)
                ),
            ]);
    }
}
