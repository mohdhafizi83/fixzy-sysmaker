<?php

namespace App\Filament\Resources\DokumenPelajars;

use App\Filament\Resources\DokumenPelajars\Pages\CreateDokumenPelajar;
use App\Filament\Resources\DokumenPelajars\Pages\EditDokumenPelajar;
use App\Filament\Resources\DokumenPelajars\Pages\ListDokumenPelajars;
use App\Filament\Resources\DokumenPelajars\Schemas\DokumenPelajarForm;
use App\Filament\Resources\DokumenPelajars\Tables\DokumenPelajarsTable;
use App\Models\DokumenPelajar;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager; //fizisysmaker:filament-auditing

class DokumenPelajarResource extends Resource
{
    protected static ?string $model = DokumenPelajar::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return DokumenPelajarForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return DokumenPelajarsTable::configure($table);
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
            'index' => ListDokumenPelajars::route('/'),
            'create' => CreateDokumenPelajar::route('/create'),
            'edit' => EditDokumenPelajar::route('/{record}/edit'),
        ];
    }
	
    // 1. Tetapkan URL
    protected static ?string $slug = 'dokumenpelajar';

    // 2. Tetapkan Label untuk satu rekod
    public static function getModelLabel(): string
    {
        return 'Dokumen Pelajar';
    }

    // 3. Tetapkan Label untuk banyak rekod (tajuk halaman utama resource)
    public static function getPluralModelLabel(): string
    {
        return 'Dokumen Pelajar';
    }
	
	// 4. Menetapkan menu kumpulan	
	public static function getNavigationGroup(): string
	{
		return 'Biodata';
	}

    // 5. Menetapkan kedudukan menu dalam kumpulan
    public static function getNavigationSort(): int
    {
        return 3; // Nombor 1 akan diletakkan paling atas dalam kumpulan 'Biodata'
    }
}
