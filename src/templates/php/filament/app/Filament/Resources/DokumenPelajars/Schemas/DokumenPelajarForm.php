<?php

namespace App\Filament\Resources\DokumenPelajars\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Select;
use Filament\Schemas\Schema;

class DokumenPelajarForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
				Select::make('pelajar_id')
					->relationship('pelajar', 'nama_penuh')
					->autofocus()
					->searchable()
					->required(),
                Textarea::make('nama_fail')
                    ->required()
                    ->columnSpanFull(),
                Textarea::make('path_fail')
                    ->required()
                    ->columnSpanFull(),
                Textarea::make('jenis_dokumen')
                    ->default('Am')
                    ->columnSpanFull(),
                DateTimePicker::make('tarikh_muatnaik'),
            ]);
    }
}
