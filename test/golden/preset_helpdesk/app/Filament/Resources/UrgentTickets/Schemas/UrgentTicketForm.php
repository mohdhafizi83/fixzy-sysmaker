<?php
namespace App\Filament\Resources\UrgentTickets\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;

class UrgentTicketForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make("Urgent Tickets")
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
                TextInput::make('ticket_no')
    ->maxLength(30)
    ->required()->markAsRequired()
    ->unique(ignoreRecord: true)
    ->label('Ticket No')
    ->trim(),
                TextInput::make('subject')
    ->maxLength(200)
    ->required()->markAsRequired()
    ->label('Subject')
    ->trim(),
                TextInput::make('requester_name')
    ->maxLength(150)
    ->required()->markAsRequired()
    ->label('Requester')
    ->trim(),
                TextInput::make('requester_email')
    ->maxLength(150)
    ->label('Requester Email')
    ->trim(),
                Select::make('priority')
    ->default('medium')
    ->label('Priority')
    ->options(['low|medium|high|urgent' => 'Low|medium|high|urgent'])
    ,
                Select::make('ticket_status')
    ->default('new')
    ->label('Status')
    ->options(['new|open|in_progress|resolved|closed' => 'New|open|in Progress|resolved|closed'])
    ,
                TextInput::make('assigned_to')
    ->maxLength(150)
    ->label('Assigned Agent')
    ->trim(),
                Textarea::make('description')
    ->columnSpanFull()
    ->label('Issue Description')
    ->trim(),
                ])
                ->columnSpanFull(),
        ]);
    }
}