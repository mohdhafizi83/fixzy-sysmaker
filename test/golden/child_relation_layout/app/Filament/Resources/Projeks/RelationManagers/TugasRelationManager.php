<?php

namespace App\Filament\Resources\Projeks\RelationManagers;

use App\Filament\Resources\Tugases\TugasResource;
use Filament\Actions\CreateAction;
use Filament\Schemas\Schema;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\Checkbox;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Components\Radio;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\RichEditor;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\TimePicker;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\Layout\Grid;
use Filament\Tables\Table;

class TugasRelationManager extends RelationManager
{
    protected static string $relationship = 'tugases';
    
    protected static ?string $relatedResource = TugasResource::class;

    public function table(Table $table): Table
    {
        return $table
            ->headerActions([
                CreateAction::make(),
            ])
            ->columns([
                Grid::make(2, [
                    TextColumn::make('id')
                    ->label('Id')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric(),
                    TextColumn::make('projek_id')
                    ->label('Projek Id')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                    ->numeric(),
                    TextColumn::make('tajuk')
                    ->label('Tajuk')
                    ->sortable()
                    ->limit(50, end: ' (more)')
                    ->searchable()
                    ->toggleable()
                ])
            ]);
    }

    public function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Info Utama')
                ->columns(1)
                ->schema([
            TextInput::make('projek_id')
                ->integer()
                ->maxLength(255)
                ->label('Projek Id')
                ->trim(),
                ]),
            Section::make('Butiran')
                ->columns(1)
                ->schema([
            TextInput::make('tajuk')
                ->maxLength(200)
                ->required()->markAsRequired()
                ->label('Tajuk')
                ->trim(),
                ]),
            Section::make('Additional Info')
                ->columns(1)
                ->schema([
            TextInput::make('id')
                ->integer()
                ->readOnly()
                ->maxLength(255)
                ->label('Id')
                ->trim(),
                ])
        ]);
    }
}
