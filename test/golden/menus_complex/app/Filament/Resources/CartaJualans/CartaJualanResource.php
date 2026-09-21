<?php

namespace App\Filament\Resources\CartaJualans;

use App\Filament\Resources\CartaJualans\Pages\CreateCartaJualan;
use App\Filament\Resources\CartaJualans\Pages\EditCartaJualan;
use App\Filament\Resources\CartaJualans\Pages\ListCartaJualans;
use App\Filament\Resources\CartaJualans\Schemas\CartaJualanForm;
use App\Filament\Resources\CartaJualans\Tables\CartaJualansTable;
use App\Models\CartaJualan;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\CartaJualanImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\CartaJualanExporter;
use Filament\Actions\ExportAction;



use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class CartaJualanResource extends Resource
{
    protected static ?string $model = CartaJualan::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return CartaJualanForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return CartaJualansTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(CartaJualanImporter::class),
ExportAction::make()->exporter(CartaJualanExporter::class)
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
            'index' => ListCartaJualans::route('/'),
            'create' => CreateCartaJualan::route('/create'),
            'edit' => EditCartaJualan::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'cartajualan';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'CartaJualan';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
