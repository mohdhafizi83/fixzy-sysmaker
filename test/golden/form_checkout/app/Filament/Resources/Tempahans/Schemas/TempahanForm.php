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
			Section::make('Order Items')
    ->columns(2)
    ->schema([
TextInput::make('nama')
    ->maxLength(255)
    ->label('Nama')
    ->trim(),
    ]),
Section::make('Billing')
    ->columns(2)
    ->schema([
Select::make('country')
    ->label('Country')
    ->options(['MY' => 'My', 'SG' => 'Sg', 'TH' => 'Th'])
    ,
    ]),
Section::make('Additional Info')
    ->columns(2)
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
                Select::make('state')
    ->label('State')
    ->options(['Johor' => 'Johor', 'Selangor' => 'Selangor', 'Perlis' => 'Perlis'])
    ,
                TextInput::make('deleted_at')
    ->label('Deleted At')
    ->trim(),
                Textarea::make('notes')
    ->maxLength(255)
    ->columnSpanFull()
    ->label('Notes')
    ->trim(),
                Checkbox::make('agree')
    ->label('Agree')
    ,
    ])
        ]);
    }
}