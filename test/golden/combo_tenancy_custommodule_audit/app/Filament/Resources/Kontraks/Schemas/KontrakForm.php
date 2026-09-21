<?php
namespace App\Filament\Resources\Kontraks\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;

class KontrakForm
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
    ->maxLength(255)
    ->label('Id')
    ->trim(),
                TextInput::make('no_rujukan')
    ->maxLength(50)
    ->required()->markAsRequired()
    ->unique(ignoreRecord: true)
    ->label('No Rujukan')
    ->trim(),
                TextInput::make('nilai')
    ->numeric()
    ->maxLength(12)
    ->label('Nilai')
    ->trim(),
                TextInput::make('created_by')
    ->integer()
    ->maxLength(255)
    ->label('Created By')
    ->trim(),
                TextInput::make('updated_by')
    ->integer()
    ->maxLength(255)
    ->label('Updated By')
    ->trim(),
                TextInput::make('deleted_by')
    ->integer()
    ->maxLength(255)
    ->label('Deleted By')
    ->trim(),
                ])
                ->columnSpanFull(),
        ]);
    }
}