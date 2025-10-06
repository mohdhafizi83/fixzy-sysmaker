<?php

namespace App\Filament\Resources\ProfilPelajars\Schemas;

use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Select;
use Filament\Schemas\Schema;

class ProfilPelajarForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
				Select::make('pelajar_id')
					->relationship('pelajar', 'nama_penuh')
					->searchable()
					->required(),
                Textarea::make('alamat')
                    ->columnSpanFull(),
                TextInput::make('no_telefon')
                    ->tel(),
                DatePicker::make('tarikh_lahir'),
                Textarea::make('info_kecemasan')
                    ->columnSpanFull(),
            ]);
    }
}
