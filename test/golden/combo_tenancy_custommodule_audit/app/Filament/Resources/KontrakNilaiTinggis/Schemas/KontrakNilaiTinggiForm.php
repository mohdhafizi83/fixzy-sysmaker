<?php
namespace App\Filament\Resources\KontrakNilaiTinggis\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\TextInput;

class KontrakNilaiTinggiForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make("KontrakNilaiTinggi")
                ->columns(fn (Page $livewire) => $livewire->gridColumns ?? 2)
                ->schema([
				TextInput::make('id')
    ->integer()
    ->readOnly()
    ->maxLength(255)
    ->label('Id')
    ->trim(),
                TextInput::make('no_rujukan')
    ->maxLength(50)
    ->required()->markAsRequired()
    ->unique(ignoreRecord: true)
    ->label('No Rujukan')
    ->trim(),
                TextInput::make('nilai')
    ->numeric()
    ->maxLength(12)
    ->label('Nilai')
    ->trim(),
                TextInput::make('created_by')
    ->integer()
    ->maxLength(255)
    ->label('Created By')
    ->trim(),
                TextInput::make('updated_by')
    ->integer()
    ->maxLength(255)
    ->label('Updated By')
    ->trim(),
                TextInput::make('deleted_by')
    ->integer()
    ->maxLength(255)
    ->label('Deleted By')
    ->trim(),
                ])
                ->columnSpanFull(),
        ]);
    }
}