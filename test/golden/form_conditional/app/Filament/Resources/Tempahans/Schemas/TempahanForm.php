<?php
namespace App\Filament\Resources\Tempahans\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Checkbox;

class TempahanForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
			Section::make('Additional Info')
    ->columns(1)
    ->schema([
TextInput::make('id')
    ->integer()
    ->readOnly()
    ->maxLength(11)
    ->label('ID')
    ->trim(),
                TextInput::make('nama')
    ->maxLength(255)
    ->label('Nama')
    ->trim(),
                TextInput::make('created_at')
    ->label('Created At')
    ->trim(),
                Select::make('country')
    ->label('Country')
    ->options(['MY' => 'My', 'SG' => 'Sg', 'TH' => 'Th'])
    ,
                TextInput::make('updated_at')
    ->label('Updated At')
    ->trim(),
                Select::make('state')
    ->label('State')
    ->options(['Johor' => 'Johor', 'Selangor' => 'Selangor', 'Perlis' => 'Perlis'])
    ->visible(fn (Get $get) => ($get('country') == 'MY'))
    ->required(fn (Get $get) => ($get('country') == 'MY'))
    ,
                TextInput::make('deleted_at')
    ->label('Deleted At')
    ->trim(),
                Textarea::make('notes')
    ->maxLength(255)
    ->columnSpanFull()
    ->label('Notes')
    ->visible(fn (Get $get) => ($get('agree') == 1 || $get('agree') === true || $get('agree') === '1'))
    ->trim(),
                Checkbox::make('agree')
    ->label('Agree')
    ,
    ])
        ]);
    }
}