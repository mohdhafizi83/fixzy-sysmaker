<?php
namespace App\Filament\Resources\FakultiWizards\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Schemas\Components\Wizard;
use Filament\Schemas\Components\Wizard\Step;
use Filament\Forms\Components\TextInput;

class FakultiWizardForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
			Wizard::make()
    ->startOnStep(1)
    ->steps([
Step::make('Main Info')
    ->schema([
TextInput::make('nama_fakulti')
    ->maxLength(150)
    ->required()->markAsRequired()
    ->label('Nama Fakulti')
    ->trim(),
    ]),
Step::make('Extra')
    ->schema([
TextInput::make('kod_fakulti')
    ->maxLength(20)
    ->unique(ignoreRecord: true)
    ->label('Kod Fakulti')
    ->trim(),
    ]),
Step::make('Other')
    ->schema([
TextInput::make('id')
    ->integer()
    ->readOnly()
    ->maxLength(255)
    ->label('Id')
    ->trim(),
    ])])
        ]);
    }
}