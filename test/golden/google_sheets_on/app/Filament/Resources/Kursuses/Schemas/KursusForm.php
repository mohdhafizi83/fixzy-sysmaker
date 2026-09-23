<?php
namespace App\Filament\Resources\Kursuses\Schemas;

use App\Filament\Resources\Kursuses\KursusResource;

use Illuminate\Contracts\View\View;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\Section;
use Filament\Actions\Action;
use Filament\Forms\Components\ViewField;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;

class KursusForm
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
                TextInput::make('nama_kursus')
    ->maxLength(150)
    ->required()->markAsRequired()
    ->label('Nama Kursus')
    ->trim(),
                TextInput::make('kod_kursus')
    ->maxLength(10)
    ->required()->markAsRequired()
    ->unique(ignoreRecord: true)
    ->label('Kod Kursus')
    ->trim(),
                TextInput::make('deskripsi')
    ->label('Deskripsi')
    ->trim(),
                TextInput::make('jam_kredit')
    ->integer()
    ->maxLength(2)
    ->default('3')
    ->label('Jam Kredit')
    ->trim(),
                Select::make('prasyarat_kursus_id')
    ->default('NULL')
    ->label('Prasyarat Kursus Id')
    ->searchable()
    ->preload()
    ->relationship(
    name: 'parent',
    titleAttribute: 'nama_kursus',
    modifyQueryUsing: fn (Builder $query, ?Model $record) => $query->where('id', '!=', $record?->id)
)
    ->suffixActions([
    Action::make('view_kursus')
        ->icon('heroicon-o-eye')
        ->modalContent(fn (Get $get): ?View => $get('prasyarat_kursus_id') ? view('filament.components.modal-iframe', ['src' => KursusResource::getUrl('edit', ['record' => $get('prasyarat_kursus_id')]) . '?iframe=1']) : null)
        ->modalWidth('6xl')
        ->modalSubmitAction(false)
        ->hidden(fn (Get $get): bool => !$get('prasyarat_kursus_id')),
    Action::make('create_kursus')
        ->icon('heroicon-o-plus')
        ->modalContent(fn (): View => view('filament.components.modal-iframe', ['src' => KursusResource::getUrl('create') . '?iframe=1']))
        ->modalWidth('6xl')
        ->modalSubmitAction(false),
])
    ,
                TextInput::make('lokasi_kelas')
    ->label('Lokasi Kelas')
    ->columnSpanFull(),
ViewField::make('lokasi_kelas')
    ->view('filament.forms.components.map-viewer')
    ->columnSpanFull(),
                TextInput::make('created_at')
    ->label('Created At')
    ->trim(),
                TextInput::make('youtube_intro')
    ->label('Youtube Intro')
    ->columnSpanFull(),
ViewField::make('youtube_intro')
    ->view('filament.forms.components.video-viewer')
    ->columnSpanFull(),
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