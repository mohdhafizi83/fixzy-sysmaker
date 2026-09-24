<?php

namespace App\Filament\Resources\TvHorizontals;

use App\Filament\Resources\TvHorizontals\Pages\CreateTvHorizontal;
use App\Filament\Resources\TvHorizontals\Pages\EditTvHorizontal;
use App\Filament\Resources\TvHorizontals\Pages\ListTvHorizontals;
use App\Filament\Resources\TvHorizontals\Schemas\TvHorizontalForm;
use App\Filament\Resources\TvHorizontals\Tables\TvHorizontalsTable;
use App\Models\TvHorizontal;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\TvHorizontalImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\TvHorizontalExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class TvHorizontalResource extends Resource
{
    protected static ?string $model = TvHorizontal::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return TvHorizontalForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return TvHorizontalsTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(TvHorizontalImporter::class),
ExportAction::make()->exporter(TvHorizontalExporter::class)
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
            'index' => ListTvHorizontals::route('/'),
            'create' => CreateTvHorizontal::route('/create'),
            'edit' => EditTvHorizontal::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'tvhorizontal';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'TvHorizontal';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
