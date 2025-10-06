<?php

namespace App\Filament\Resources\NewPendaftaranKursuses\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Select;
use Filament\Schemas\Schema;

class NewPendaftaranKursusForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
				Select::make('pelajar_id')
					->relationship('pelajar', 'nama_penuh')
					->searchable()
					->required(),
                Select::make('kursus_id')
					->relationship('kursus', 'nama_kursus')
					->searchable()
					->required(),
                DateTimePicker::make('tarikh_pendaftaran')
                    ->required(),
                TextInput::make('gred'),
                TextInput::make('status')
                    ->required()
                    ->default('Pending'),
            ]);
    }
}
