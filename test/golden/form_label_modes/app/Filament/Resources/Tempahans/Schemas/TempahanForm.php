<?php
namespace App\Filament\Resources\Tempahans\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
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
    ->placeholder('ID')
    ->label('ID')
    ->hiddenLabel()
    ->trim(),
                TextInput::make('nama')
    ->maxLength(255)
    ->label('Nama')
    ->inlineLabel()
    ->trim(),
                TextInput::make('created_at')
    ->placeholder('Created At')
    ->label('Created At')
    ->hiddenLabel()
    ->trim(),
                Select::make('country')
    ->label('Country')
    ->options(['MY' => 'My', 'SG' => 'Sg', 'TH' => 'Th'])
    ,
                TextInput::make('updated_at')
    ->placeholder('Updated At')
    ->label('Updated At')
    ->hiddenLabel()
    ->trim(),
                Select::make('state')
    ->placeholder('State')
    ->label('State')
    ->options(['Johor' => 'Johor', 'Selangor' => 'Selangor', 'Perlis' => 'Perlis'])
    ->hiddenLabel()
    ,
                TextInput::make('deleted_at')
    ->placeholder('Deleted At')
    ->label('Deleted At')
    ->hiddenLabel()
    ->trim(),
                Textarea::make('notes')
    ->maxLength(255)
    ->placeholder('Notes')
    ->columnSpanFull()
    ->label('Notes')
    ->hiddenLabel()
    ->trim(),
                Checkbox::make('agree')
    ->label('Agree')
    ,
    ])
        ]);
    }
}