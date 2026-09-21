<?php
namespace App\Filament\Resources\ItemTempahans\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;

class ItemTempahanForm
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
                TextInput::make('tempahan_id')
    ->integer()
    ->maxLength(255)
    ->label('Tempahan Id')
    ->trim(),
                TextInput::make('produk')
    ->maxLength(100)
    ->required()->markAsRequired()
    ->label('Produk')
    ->trim(),
                TextInput::make('kuantiti')
    ->integer()
    ->maxLength(255)
    ->label('Kuantiti')
    ->trim(),
                TextInput::make('harga')
    ->numeric()
    ->maxLength(10)
    ->label('Harga')
    ->trim(),
                ])
                ->columnSpanFull(),
        ]);
    }
}