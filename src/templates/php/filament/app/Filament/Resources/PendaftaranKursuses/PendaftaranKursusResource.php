<?php

namespace App\Filament\Resources\PendaftaranKursuses;

use App\Filament\Resources\PendaftaranKursuses\Pages\CreatePendaftaranKursus;
use App\Filament\Resources\PendaftaranKursuses\Pages\EditPendaftaranKursus;
use App\Filament\Resources\PendaftaranKursuses\Pages\ListPendaftaranKursuses;
use App\Filament\Resources\PendaftaranKursuses\Schemas\PendaftaranKursusForm;
use App\Filament\Resources\PendaftaranKursuses\Tables\PendaftaranKursusesTable;
use App\Models\PendaftaranKursus;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager; //fizisysmaker:filament-auditing

class PendaftaranKursusResource extends Resource
{
    protected static ?string $model = PendaftaranKursus::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return PendaftaranKursusForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PendaftaranKursusesTable::configure($table);
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
            'index' => ListPendaftaranKursuses::route('/'),
            'create' => CreatePendaftaranKursus::route('/create'),
            'edit' => EditPendaftaranKursus::route('/{record}/edit'),
        ];
    }
	
    // 1. Tetapkan URL
    protected static ?string $slug = 'pendaftarankursus';

    // 2. Tetapkan Label untuk satu rekod
    public static function getModelLabel(): string
    {
        return 'Pendaftaran Kursus';
    }

    // 3. Tetapkan Label untuk banyak rekod (tajuk halaman utama resource)
    public static function getPluralModelLabel(): string
    {
        return 'Pendaftaran Kursus';
    }
	
	// 4. Menetapkan menu kumpulan	
	public static function getNavigationGroup(): string
	{
		return 'Akademik';
	}

    // 5. Menetapkan kedudukan menu dalam kumpulan
    public static function getNavigationSort(): int
    {
        return 2; // Nombor 1 akan diletakkan paling atas dalam kumpulan 'Akademik'
    }
}
