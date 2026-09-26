<?php
namespace App\Filament\Resources\Tempahans\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Schemas\Components\Wizard;
use Filament\Schemas\Components\Wizard\Step;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Checkbox;

class TempahanForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
			Wizard::make()
    ->startOnStep(1)
    ->steps([
Step::make('Step One')
    ->schema([
TextInput::make('nama')
    ->maxLength(255)
    ->label('Nama')
    ->trim(),
                Select::make('country')
    ->label('Country')
    ->options(['MY' => 'My', 'SG' => 'Sg', 'TH' => 'Th'])
    ,
    ]),
Step::make('Step Two')
    ->schema([
Select::make('state')
    ->label('State')
    ->options(['Johor' => 'Johor', 'Selangor' => 'Selangor', 'Perlis' => 'Perlis'])
    ,
                Textarea::make('notes')
    ->maxLength(255)
    ->columnSpanFull()
    ->label('Notes')
    ->trim(),
    ]),
Step::make('Additional Info')
    ->schema([
TextInput::make('id')
    ->integer()
    ->readOnly()
    ->maxLength(11)
    ->label('ID')
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
                Checkbox::make('agree')
    ->label('Agree')
    ,
    ])])
        ]);
    }
}