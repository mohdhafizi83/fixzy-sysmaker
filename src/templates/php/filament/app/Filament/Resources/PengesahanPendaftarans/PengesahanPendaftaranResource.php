<?php

namespace App\Filament\Resources\PengesahanPendaftarans;

use App\Filament\Resources\PengesahanPendaftarans\Pages\CreatePengesahanPendaftaran;
use App\Filament\Resources\PengesahanPendaftarans\Pages\EditPengesahanPendaftaran;
use App\Filament\Resources\PengesahanPendaftarans\Pages\ListPengesahanPendaftarans;
use App\Filament\Resources\PengesahanPendaftarans\Schemas\PengesahanPendaftaranForm;
use App\Filament\Resources\PengesahanPendaftarans\Tables\PengesahanPendaftaransTable;
use App\Models\PengesahanPendaftaran;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager; //fizisysmaker:filament-auditing

class PengesahanPendaftaranResource extends Resource
{
    protected static ?string $model = PengesahanPendaftaran::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;
    // Urutkan Kedudukan Menu
    protected static ?int $navigationSort = 2;
	
    public static function form(Schema $schema): Schema
    {
        return PengesahanPendaftaranForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PengesahanPendaftaransTable::configure($table);
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
            'index' => ListPengesahanPendaftarans::route('/'),
            'create' => CreatePengesahanPendaftaran::route('/create'),
            'edit' => EditPengesahanPendaftaran::route('/{record}/edit'),
        ];
    }
	
    // 1. Tetapkan URL
    protected static ?string $slug = 'pengesahanpendaftaran';

    // 2. Tetapkan Label untuk satu rekod
    public static function getModelLabel(): string
    {
        return 'Pengesahan Pendaftaran';
    }

    // 3. Tetapkan Label untuk banyak rekod (tajuk halaman utama resource)
    public static function getPluralModelLabel(): string
    {
        return 'Pengesahan Pendaftaran';
    }
}
