<?php
namespace App\Filament\Resources\DokumenPelajars\Schemas;

use App\Filament\Resources\Pelajars\PelajarResource;

use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\Section;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;

class DokumenPelajarForm
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
    ->label('Id')
    ->trim(),
                Select::make('pelajar_id')
    ->required()->markAsRequired()
    ->label('Pelajar Id')
    ->searchable()
    ->preload()
    ->disabled(session('foreignkey') === 'pelajar_id')
    ->relationship('pelajar', 'nama_penuh')
    ->suffixActions([
    Action::make('view_pelajar')
        ->icon('heroicon-o-eye')
        ->modalContent(fn (Get $get): ?View => $get('pelajar_id') ? view('filament.components.modal-iframe', ['src' => PelajarResource::getUrl('edit', ['record' => $get('pelajar_id')]) . '?iframe=1']) : null)
        ->modalWidth('6xl')
        ->modalSubmitAction(false)
        ->hidden(fn (Get $get): bool => !$get('pelajar_id')),
    Action::make('create_pelajar')
        ->icon('heroicon-o-plus')
        ->modalContent(fn (): View => view('filament.components.modal-iframe', ['src' => PelajarResource::getUrl('create') . '?iframe=1']))
        ->modalWidth('6xl')
        ->modalSubmitAction(false),
])
    ,
                TextInput::make('nama_fail')
    ->maxLength(200)
    ->required()->markAsRequired()
    ->label('Nama Fail')
    ->trim(),
                TextInput::make('path_fail')
    ->maxLength(255)
    ->required()->markAsRequired()
    ->label('Path Fail')
    ->trim(),
                TextInput::make('jenis_dokumen')
    ->maxLength(50)
    ->default('Am')
    ->label('Jenis Dokumen')
    ->trim(),
                TextInput::make('tarikh_muatnaik')
    ->default('CURRENT_TIMESTAMP')
    ->label('Tarikh Muatnaik')
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
                ])
                ->columnSpanFull(),
        ]);
    }
}