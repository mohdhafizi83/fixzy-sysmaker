<?php
namespace App\Filament\Resources\FakultiAktifs\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\TextInput;

class FakultiAktifForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make("FakultiAktif")
                ->columns(fn (Page $livewire) => $livewire->gridColumns ?? 2)
                ->schema([
				TextInput::make('id')
    ->integer()
    ->readOnly()
    ->maxLength(255)
    ->label('Id')
    ->trim(),
                TextInput::make('nama_fakulti')
    ->maxLength(150)
    ->required()->markAsRequired()
    ->label('Nama Fakulti')
    ->trim(),
                ])
                ->columnSpanFull(),
        ]);
    }
}