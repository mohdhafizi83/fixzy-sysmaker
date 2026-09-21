<?php

namespace App\Filament\Resources\JanaBils;

use App\Filament\Resources\JanaBils\Pages\CreateJanaBil;
use App\Filament\Resources\JanaBils\Pages\EditJanaBil;
use App\Filament\Resources\JanaBils\Pages\ListJanaBils;
use App\Filament\Resources\JanaBils\Schemas\JanaBilForm;
use App\Filament\Resources\JanaBils\Tables\JanaBilsTable;
use App\Models\JanaBil;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\JanaBilImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\JanaBilExporter;
use Filament\Actions\ExportAction;



use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class JanaBilResource extends Resource
{
    protected static ?string $model = JanaBil::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return JanaBilForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return JanaBilsTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(JanaBilImporter::class),
ExportAction::make()->exporter(JanaBilExporter::class)
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
            'index' => ListJanaBils::route('/'),
            'create' => CreateJanaBil::route('/create'),
            'edit' => EditJanaBil::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'janabil';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'JanaBil';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
