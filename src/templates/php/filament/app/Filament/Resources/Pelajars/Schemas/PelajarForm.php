<?php

namespace App\Filament\Resources\Pelajars\Schemas;

use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

use Filament\Schemas\Components\Section;

class PelajarForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                // KUMPULAN 1: Muncul di bahagian atas
                Section::make('Maklumat Asas Pelajar')
                    ->schema([
                        TextInput::make('nama_penuh')->required(),
                        TextInput::make('no_matrik')->required()->unique(ignoreRecord: true),
                        TextInput::make('email')->email()->required()->unique(ignoreRecord: true),
                        DatePicker::make('tarikh_daftar'),
                        TextInput::make('gambar_profil'),
                    ])->columns(2),

                // KUMPULAN 2: Muncul di bahagian bawah
                Section::make('Profil Pelajar')
                    ->relationship('profilPelajar')
                    ->schema([
                        TextInput::make('alamat'),
                        TextInput::make('no_telefon'),
                        DatePicker::make('tarikh_lahir'),
                        TextInput::make('info_kecemasan'),
                    ])->columns(2),
            ]);
    }
}
