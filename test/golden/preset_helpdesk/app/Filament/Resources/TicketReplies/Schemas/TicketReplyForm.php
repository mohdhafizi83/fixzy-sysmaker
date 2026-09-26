<?php
namespace App\Filament\Resources\TicketReplies\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;

class TicketReplyForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make("Detail View")
                ->columns(fn (Page $livewire) => $livewire->gridColumns)
    ->headerActions([
        Action::make('1 Kolum')
            ->icon('heroicon-o-queue-list')
            ->iconButton()
            ->color('gray')
            ->tooltip('Display 1 column')
            ->action(fn (Page $livewire) => $livewire->gridColumns = 1),

        Action::make('2 Kolum')
            ->icon('heroicon-o-view-columns')
            ->iconButton()
            ->color('gray')
            ->tooltip('Display 2 column')
            ->action(fn (Page $livewire) => $livewire->gridColumns = 2),

        Action::make('3 Kolum')
            ->icon('heroicon-o-table-cells')
            ->iconButton()
            ->color('gray')
            ->tooltip('Display 3 column')
            ->action(fn (Page $livewire) => $livewire->gridColumns = 3),
    ])
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
                TextInput::make('ticket_id')
    ->integer()
    ->required()->markAsRequired()
    ->label('Ticket')
    ->trim(),
                TextInput::make('reply_from')
    ->maxLength(150)
    ->required()->markAsRequired()
    ->label('Reply From')
    ->trim(),
                TextInput::make('is_agent_reply')
    ->required()->markAsRequired()
    ->default('0')
    ->label('Agent Reply')
    ->trim(),
                Textarea::make('message')
    ->columnSpanFull()
    ->label('Message')
    ->trim(),
                ])
                ->columnSpanFull(),
        ]);
    }
}