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
    ->label('ID')
    ->inlineLabel()
    ->trim(),
                TextInput::make('nama')
    ->maxLength(255)
    ->label('Nama')
    ->inlineLabel()
    ->trim(),
                TextInput::make('created_at')
    ->label('Created At')
    ->inlineLabel()
    ->trim(),
                Select::make('country')
    ->label('Country')
    ->options(['MY' => 'My', 'SG' => 'Sg', 'TH' => 'Th'])
    ->inlineLabel()
    ,
                TextInput::make('updated_at')
    ->label('Updated At')
    ->inlineLabel()
    ->trim(),
                Select::make('state')
    ->label('State')
    ->options(['Johor' => 'Johor', 'Selangor' => 'Selangor', 'Perlis' => 'Perlis'])
    ->inlineLabel()
    ,
                TextInput::make('deleted_at')
    ->label('Deleted At')
    ->inlineLabel()
    ->trim(),
                Textarea::make('notes')
    ->maxLength(255)
    ->columnSpanFull()
    ->label('Notes')
    ->inlineLabel()
    ->trim(),
                Checkbox::make('agree')
    ->label('Agree')
    ,
    ])
        ]);
    }
}