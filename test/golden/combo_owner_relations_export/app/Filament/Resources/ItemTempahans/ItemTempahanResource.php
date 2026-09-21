<?php

namespace App\Filament\Resources\ItemTempahans;

use App\Filament\Resources\ItemTempahans\Pages\CreateItemTempahan;
use App\Filament\Resources\ItemTempahans\Pages\EditItemTempahan;
use App\Filament\Resources\ItemTempahans\Pages\ListItemTempahans;
use App\Filament\Resources\ItemTempahans\Schemas\ItemTempahanForm;
use App\Filament\Resources\ItemTempahans\Tables\ItemTempahansTable;
use App\Models\ItemTempahan;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\ItemTempahanImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\ItemTempahanExporter;
use Filament\Actions\ExportAction;



use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class ItemTempahanResource extends Resource
{
    protected static ?string $model = ItemTempahan::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return ItemTempahanForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ItemTempahansTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(ItemTempahanImporter::class),
ExportAction::make()->exporter(ItemTempahanExporter::class)
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
            'index' => ListItemTempahans::route('/'),
            'create' => CreateItemTempahan::route('/create'),
            'edit' => EditItemTempahan::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'itemtempahan';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'ItemTempahan';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
