<?php
namespace App\Filament\Resources\LogPentings\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\FileUpload;

class LogPentingForm
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
                TextInput::make('perihal')
    ->maxLength(200)
    ->required()->markAsRequired()
    ->label('Perihal')
    ->trim(),
                FileUpload::make('dokumen')
    ->label('Documents')
    ->multiple()
    ->maxFiles(5)
    ->maxSize(5120)
    ->directory('attachments/dokumen')
    ->disk('local')
    ->visibility('private')
    ->columnSpanFull()
    ->acceptedFileTypes(['pdf', 'jpg', 'png']),
                ])
                ->columnSpanFull(),
        ]);
    }
}