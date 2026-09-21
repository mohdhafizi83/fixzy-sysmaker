<?php

namespace App\Filament\Resources\Inventoris;

use App\Filament\Resources\Inventoris\Pages\CreateInventori;
use App\Filament\Resources\Inventoris\Pages\EditInventori;
use App\Filament\Resources\Inventoris\Pages\ListInventoris;
use App\Filament\Resources\Inventoris\Schemas\InventoriForm;
use App\Filament\Resources\Inventoris\Tables\InventorisTable;
use App\Models\Inventori;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\InventoriImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\InventoriExporter;
use Filament\Actions\ExportAction;



use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class InventoriResource extends Resource
{
    protected static ?string $model = Inventori::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return InventoriForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return InventorisTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(InventoriImporter::class),
ExportAction::make()->exporter(InventoriExporter::class)
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
            'index' => ListInventoris::route('/'),
            'create' => CreateInventori::route('/create'),
            'edit' => EditInventori::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'inventori';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Inventori';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
