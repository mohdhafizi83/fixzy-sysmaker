<?php

namespace App\Filament\Resources\Organisasis;

use App\Filament\Resources\Organisasis\Pages\CreateOrganisasi;
use App\Filament\Resources\Organisasis\Pages\EditOrganisasi;
use App\Filament\Resources\Organisasis\Pages\ListOrganisasis;
use App\Filament\Resources\Organisasis\Schemas\OrganisasiForm;
use App\Filament\Resources\Organisasis\Tables\OrganisasisTable;
use App\Models\Organisasi;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\OrganisasiImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\OrganisasiExporter;
use Filament\Actions\ExportAction;

use App\Filament\Resources\Organisasis\RelationManagers\ProdukRelationManager;
use App\Filament\RelationManagers\AuditsRelationManager;

class OrganisasiResource extends Resource
{
    protected static ?string $model = Organisasi::class;
    
        protected static bool $isScopedToTenant = false;


    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return OrganisasiForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return OrganisasisTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(OrganisasiImporter::class),
ExportAction::make()->exporter(OrganisasiExporter::class)
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
                        ProdukRelationManager::class,
        ];
		

    // Only add AuditsRelationManager if the user is allowed to view it
    
        if (auth()->check() && auth()->user()->can('view_any_audit')) {
            $relations[] = AuditsRelationManager::class;
        }
	
	return $relations;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListOrganisasis::route('/'),
            'create' => CreateOrganisasi::route('/create'),
            'edit' => EditOrganisasi::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'organisasi';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Organisasi';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
