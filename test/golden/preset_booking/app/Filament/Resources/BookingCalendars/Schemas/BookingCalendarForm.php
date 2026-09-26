<?php
namespace App\Filament\Resources\BookingCalendars\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;

class BookingCalendarForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make("Booking Calendar")
                ->columns(fn (Page $livewire) => $livewire->gridColumns ?? 2)
                ->schema([
				TextInput::make('id')
    ->integer()
    ->readOnly()
    ->maxLength(11)
    ->label('ID')
    ->trim(),
                TextInput::make('created_at')
    ->readOnly()
    ->label('Created At')
    ->trim(),
                TextInput::make('updated_at')
    ->readOnly()
    ->label('Updated At')
    ->trim(),
                TextInput::make('deleted_at')
    ->readOnly()
    ->label('Deleted At')
    ->trim(),
                TextInput::make('created_by')
    ->integer()
    ->readOnly()
    ->maxLength(20)
    ->label('Created By')
    ->trim(),
                TextInput::make('updated_by')
    ->integer()
    ->readOnly()
    ->maxLength(20)
    ->label('Updated By')
    ->trim(),
                TextInput::make('deleted_by')
    ->integer()
    ->readOnly()
    ->maxLength(20)
    ->label('Deleted By')
    ->trim(),
                TextInput::make('booking_ref')
    ->maxLength(30)
    ->required()->markAsRequired()
    ->unique(ignoreRecord: true)
    ->label('Booking Ref')
    ->trim(),
                TextInput::make('resource_id')
    ->integer()
    ->required()->markAsRequired()
    ->label('Resource')
    ->trim(),
                TextInput::make('booker_name')
    ->maxLength(150)
    ->required()->markAsRequired()
    ->label('Booker Name')
    ->trim(),
                TextInput::make('booker_email')
    ->maxLength(150)
    ->label('Booker Email')
    ->trim(),
                TextInput::make('start_datetime')
    ->required()->markAsRequired()
    ->label('Start')
    ->trim(),
                TextInput::make('end_datetime')
    ->required()->markAsRequired()
    ->label('End')
    ->trim(),
                TextInput::make('attendees')
    ->integer()
    ->label('Attendees')
    ->trim(),
                Textarea::make('notes')
    ->columnSpanFull()
    ->label('Notes')
    ->trim(),
                Select::make('booking_status')
    ->default('pending')
    ->label('Status')
    ->options(['pending|confirmed|cancelled|completed' => 'Pending|confirmed|cancelled|completed'])
    ,
                ])
                ->columnSpanFull(),
        ]);
    }
}