<?php

namespace App\Filament\Resources\Pelajars;

use App\Filament\Resources\Pelajars\Pages\CreatePelajar;
use App\Filament\Resources\Pelajars\Pages\EditPelajar;
use App\Filament\Resources\Pelajars\Pages\ListPelajars;
use App\Filament\Resources\Pelajars\Schemas\PelajarForm;
use App\Filament\Resources\Pelajars\Tables\PelajarsTable;
use App\Models\Pelajar;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder; // fiziSysMaker - count child

use App\Filament\Exports\PelajarExporter;
use Filament\Actions\ExportAction;
use App\Filament\Imports\PelajarImporter;
use Filament\Actions\ImportAction;

use App\Filament\Resources\Pelajars\RelationManagers\DokumenPelajarRelationManager; //fizisysmaker:filament-auditing
use App\Filament\Resources\Pelajars\RelationManagers\PendaftaranKursusRelationManager; //fizisysmaker:filament-auditing
use App\Filament\Resources\Pelajars\RelationManagers\ProfilPelajarRelationManager; //fizisysmaker:filament-auditing

use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager; //fizisysmaker:filament-auditing

use App\Filament\Actions\PrintAction; // fizisysmaker -print view

class PelajarResource extends Resource
{
    protected static ?string $model = Pelajar::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    /**
     * Pra-muat kiraan hubungan (relationship count) untuk prestasi dan sorting.
     */
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCount('dokumenPelajar');
    }

    public static function form(Schema $schema): Schema
    {
        return PelajarForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PelajarsTable::configure($table)
		        ->headerActions([
            ImportAction::make()
                ->importer(PelajarImporter::class),
            ExportAction::make()
                ->exporter(PelajarExporter::class),
			PrintAction::make(),
        ]);
    }

    public static function getRelations(): array
    {
        $relations = [
            DokumenPelajarRelationManager::class, //fizisysmaker - child table
			PendaftaranKursusRelationManager::class, //fizisysmaker - child table
			ProfilPelajarRelationManager::class, //fizisysmaker - child table
        ];
		

    if (auth()->check() && auth()->user()->can('view_any_audit')) {
        $relations[] = AuditsRelationManager::class; //fizisysmaker - filament-auditing shield
    }
	
	return $relations;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListPelajars::route('/'),
            'create' => CreatePelajar::route('/create'),
            'edit' => EditPelajar::route('/{record}/edit'),
        ];
    }
	
    // 1. Tetapkan URL
    protected static ?string $slug = 'pelajar';

    // 2. Tetapkan Label untuk satu rekod
    public static function getModelLabel(): string
    {
        return 'Pelajar';
    }

    // 3. Tetapkan Label untuk banyak rekod (tajuk halaman utama resource)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar-Pelajar';
    }
    
    public static function getNavigationLabel(): string
    {
        return 'PelajarX'; // Label yang lebih ringkas untuk menu
    }
    
	// 4. Menetapkan menu kumpulan	
	public static function getNavigationGroup(): string
	{
		return 'Biodata';
	}

    // 5. Menetapkan kedudukan menu dalam kumpulan
    public static function getNavigationSort(): int
    {
        return 1; // Nombor 1 akan diletakkan paling atas dalam kumpulan 'Biodata'
    }
}