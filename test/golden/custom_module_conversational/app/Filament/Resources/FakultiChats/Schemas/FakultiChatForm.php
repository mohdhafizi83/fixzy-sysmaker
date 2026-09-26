<?php
namespace App\Filament\Resources\FakultiChats\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\TextInput;

class FakultiChatForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
			Section::make('Other')
    ->columns(1)
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
    ->trim()->disabled()->dehydrated(false),
                TextInput::make('kod_fakulti')
    ->maxLength(20)
    ->unique(ignoreRecord: true)
    ->label('Kod Fakulti')
    ->trim(),
    ])
        ]);
    }
}