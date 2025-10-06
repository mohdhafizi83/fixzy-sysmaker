<?php

namespace App\Filament\Resources\PengesahanPendaftarans\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Schemas\Schema;

class PengesahanPendaftaranForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('pendaftaran_id')
                    ->required()
                    ->numeric(),
                TextInput::make('user_id')
                    ->required()
                    ->numeric(),
                Textarea::make('status_baharu')
                    ->required()
                    ->columnSpanFull(),
                Textarea::make('catatan')
                    ->default('NULL')
                    ->columnSpanFull(),
                DateTimePicker::make('tarikh_tindakan')
                    ->required(),
            ]);
    }
}
