<?php

namespace App\Filament\Resources\Kursuses;

use App\Filament\Resources\Kursuses\Pages\CreateKursus;
use App\Filament\Resources\Kursuses\Pages\EditKursus;
use App\Filament\Resources\Kursuses\Pages\ListKursuses;
use App\Filament\Resources\Kursuses\Schemas\KursusForm;
use App\Filament\Resources\Kursuses\Tables\KursusesTable;
use App\Models\Kursus;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager; //fizisysmaker:filament-auditing

class KursusResource extends Resource
{
    protected static ?string $model = Kursus::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return KursusForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return KursusesTable::configure($table);
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
            'index' => ListKursuses::route('/'),
            'create' => CreateKursus::route('/create'),
            'edit' => EditKursus::route('/{record}/edit'),
        ];
    }
	
    // 1. Tetapkan URL
    protected static ?string $slug = 'kursus';

    // 2. Tetapkan Label untuk satu rekod
    public static function getModelLabel(): string
    {
        return 'Kursus';
    }

    // 3. Tetapkan Label untuk banyak rekod (tajuk halaman utama resource)
    public static function getPluralModelLabel(): string
    {
        return 'Kursus';
    }
	
	// 4. Menetapkan menu kumpulan	
	public static function getNavigationGroup(): string
	{
		return 'Akademik';
	}

    // 5. Menetapkan kedudukan menu dalam kumpulan
    public static function getNavigationSort(): int
    {
        return 1; // Nombor 1 akan diletakkan paling atas dalam kumpulan 'Akademik'
    }
}
