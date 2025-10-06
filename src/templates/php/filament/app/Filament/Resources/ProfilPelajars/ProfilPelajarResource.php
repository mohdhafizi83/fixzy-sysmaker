<?php

namespace App\Filament\Resources\ProfilPelajars;

use App\Filament\Resources\ProfilPelajars\Pages\CreateProfilPelajar;
use App\Filament\Resources\ProfilPelajars\Pages\EditProfilPelajar;
use App\Filament\Resources\ProfilPelajars\Pages\ListProfilPelajars;
use App\Filament\Resources\ProfilPelajars\Schemas\ProfilPelajarForm;
use App\Filament\Resources\ProfilPelajars\Tables\ProfilPelajarsTable;
use App\Models\ProfilPelajar;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager; //fizisysmaker:filament-auditing

class ProfilPelajarResource extends Resource
{
    protected static ?string $model = ProfilPelajar::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return ProfilPelajarForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ProfilPelajarsTable::configure($table);
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
            'index' => ListProfilPelajars::route('/'),
            'create' => CreateProfilPelajar::route('/create'),
            'edit' => EditProfilPelajar::route('/{record}/edit'),
        ];
    }

    // 1. Tetapkan URL
    protected static ?string $slug = 'profilpelajar';

    // 2. Tetapkan Label untuk satu rekod
    public static function getModelLabel(): string
    {
        return 'Profil Pelajar';
    }

    // 3. Tetapkan Label untuk banyak rekod (tajuk halaman utama resource)
    public static function getPluralModelLabel(): string
    {
        return 'Profil Pelajar';
    }
	
	// 4. Menetapkan menu kumpulan	
	public static function getNavigationGroup(): string
	{
		return 'Biodata';
	}

    // 5. Menetapkan kedudukan menu dalam kumpulan
    public static function getNavigationSort(): int
    {
        return 2; // Nombor 1 akan diletakkan paling atas dalam kumpulan 'Biodata'
    }
}
