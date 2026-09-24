<?php

namespace App\Filament\Resources\TvLeftimages;

use App\Filament\Resources\TvLeftimages\Pages\CreateTvLeftimage;
use App\Filament\Resources\TvLeftimages\Pages\EditTvLeftimage;
use App\Filament\Resources\TvLeftimages\Pages\ListTvLeftimages;
use App\Filament\Resources\TvLeftimages\Schemas\TvLeftimageForm;
use App\Filament\Resources\TvLeftimages\Tables\TvLeftimagesTable;
use App\Models\TvLeftimage;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\TvLeftimageImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\TvLeftimageExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class TvLeftimageResource extends Resource
{
    protected static ?string $model = TvLeftimage::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return TvLeftimageForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return TvLeftimagesTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(TvLeftimageImporter::class),
ExportAction::make()->exporter(TvLeftimageExporter::class)
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
		

    // Only add AuditsRelationManager if the user is allowed to view it
    
        if (auth()->check() && auth()->user()->can('view_any_audit')) {
            $relations[] = AuditsRelationManager::class;
        }
	
	return $relations;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListTvLeftimages::route('/'),
            'create' => CreateTvLeftimage::route('/create'),
            'edit' => EditTvLeftimage::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'tvleftimage';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'TvLeftimage';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
