<?php

namespace App\Filament\Resources\Projeks;

use App\Filament\Resources\Projeks\Pages\CreateProjek;
use App\Filament\Resources\Projeks\Pages\EditProjek;
use App\Filament\Resources\Projeks\Pages\ListProjeks;
use App\Filament\Resources\Projeks\Schemas\ProjekForm;
use App\Filament\Resources\Projeks\Tables\ProjeksTable;
use App\Models\Projek;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\ProjekImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\ProjekExporter;
use Filament\Actions\ExportAction;

use App\Filament\Resources\Projeks\RelationManagers\TugasRelationManager;
use App\Filament\RelationManagers\AuditsRelationManager;

class ProjekResource extends Resource
{
    protected static ?string $model = Projek::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return ProjekForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ProjeksTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(ProjekImporter::class),
ExportAction::make()->exporter(ProjekExporter::class)
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
                        TugasRelationManager::class,
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
            'index' => ListProjeks::route('/'),
            'create' => CreateProjek::route('/create'),
            'edit' => EditProjek::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'projek';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Projek';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
