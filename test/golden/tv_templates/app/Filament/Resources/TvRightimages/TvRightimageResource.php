<?php

namespace App\Filament\Resources\TvRightimages;

use App\Filament\Resources\TvRightimages\Pages\CreateTvRightimage;
use App\Filament\Resources\TvRightimages\Pages\EditTvRightimage;
use App\Filament\Resources\TvRightimages\Pages\ListTvRightimages;
use App\Filament\Resources\TvRightimages\Schemas\TvRightimageForm;
use App\Filament\Resources\TvRightimages\Tables\TvRightimagesTable;
use App\Models\TvRightimage;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\TvRightimageImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\TvRightimageExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class TvRightimageResource extends Resource
{
    protected static ?string $model = TvRightimage::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return TvRightimageForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return TvRightimagesTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(TvRightimageImporter::class),
ExportAction::make()->exporter(TvRightimageExporter::class)
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
            'index' => ListTvRightimages::route('/'),
            'create' => CreateTvRightimage::route('/create'),
            'edit' => EditTvRightimage::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'tvrightimage';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'TvRightimage';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
