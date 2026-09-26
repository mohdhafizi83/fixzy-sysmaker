<?php
namespace App\Filament\Resources\FakultiBoards\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\TextInput;

class FakultiBoardForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make("FakultiBoard")
                ->columns(fn (Page $livewire) => $livewire->gridColumns ?? 2)
                ->schema([
				TextInput::make('id')
    ->integer()
    ->readOnly()
    ->maxLength(11)
    ->label('ID')
    ->trim(),
                TextInput::make('nama_fakulti')
    ->maxLength(255)
    ->required()->markAsRequired()
    ->label('Nama Fakulti')
    ->trim(),
                TextInput::make('created_at')
    ->label('Created At')
    ->trim(),
                TextInput::make('updated_at')
    ->label('Updated At')
    ->trim(),
                TextInput::make('deleted_at')
    ->label('Deleted At')
    ->trim(),
                ])
                ->columnSpanFull(),
        ]);
    }
}