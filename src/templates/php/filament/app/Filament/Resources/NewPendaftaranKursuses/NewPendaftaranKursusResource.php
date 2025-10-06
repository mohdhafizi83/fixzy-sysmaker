<?php

namespace App\Filament\Resources\NewPendaftaranKursuses;

use App\Filament\Resources\NewPendaftaranKursuses\Pages\CreateNewPendaftaranKursus;
use App\Filament\Resources\NewPendaftaranKursuses\Pages\EditNewPendaftaranKursus;
use App\Filament\Resources\NewPendaftaranKursuses\Pages\ListNewPendaftaranKursuses;
use App\Filament\Resources\NewPendaftaranKursuses\Schemas\NewPendaftaranKursusForm;
use App\Filament\Resources\NewPendaftaranKursuses\Tables\NewPendaftaranKursusesTable;
use App\Models\PendaftaranKursus;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Illuminate\Database\Eloquent\Builder;

use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager; //fizisysmaker:filament-auditing

class NewPendaftaranKursusResource extends Resource
{
    protected static ?string $model = PendaftaranKursus::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return NewPendaftaranKursusForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return NewPendaftaranKursusesTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            AuditsRelationManager::class, //fizisysmaker:filament-auditing
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListNewPendaftaranKursuses::route('/'),
            'create' => CreateNewPendaftaranKursus::route('/create'),
            'edit' => EditNewPendaftaranKursus::route('/{record}/edit'),
        ];
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('status', 'Baru');
    }
	
    // 1. Tetapkan URL
    protected static ?string $slug = 'newpendaftarankursus';

    // 2. Tetapkan Label untuk satu rekod
    public static function getModelLabel(): string
    {
        return 'New Pendaftaran Kursus';
    }

    // 3. Tetapkan Label untuk banyak rekod (tajuk halaman utama resource)
    public static function getPluralModelLabel(): string
    {
        return 'New Pendaftaran Kursus';
    }
	
	// 4. Menetapkan menu kumpulan	
	public static function getNavigationGroup(): string
	{
		return 'Akademik';
	}

    // 5. Menetapkan kedudukan menu dalam kumpulan
    public static function getNavigationSort(): int
    {
        return 3; // Nombor 1 akan diletakkan paling atas dalam kumpulan 'Akademik'
    }
}
