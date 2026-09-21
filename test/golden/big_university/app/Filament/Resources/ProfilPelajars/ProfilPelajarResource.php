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

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\ProfilPelajarImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\ProfilPelajarExporter;
use Filament\Actions\ExportAction;



use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

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
        return ProfilPelajarsTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(ProfilPelajarImporter::class),
ExportAction::make()->exporter(ProfilPelajarExporter::class)
                /*->enableVisibleTableColumnsByDefault()*/,
			Action::make('print')
                    ->label('Print')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => request()->fullUrlWithQuery(['print' => 1]))
                    ->openUrlInNewTab(),
        ]);
    }

    public static function getRelations(): array
    {
        $relations = [
            
        ];
		

    // Hanya tambah AuditsRelationManager jika pengguna boleh melihatnya
    
        if (auth()->check() && auth()->user()->can('view_any_audit')) {
            $relations[] = AuditsRelationManager::class;
        }
	
	return $relations;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListProfilPelajars::route('/'),
            'create' => CreateProfilPelajar::route('/create'),
            'edit' => EditProfilPelajar::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'profilpelajar';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'ProfilPelajar';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Profil Pelajar';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Biodata';
    }

    
    public static function getNavigationSort(): int
    {
        return 1;
    }
}
