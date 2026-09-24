<?php

namespace App\Filament\Resources\TvVertical1s;

use App\Filament\Resources\TvVertical1s\Pages\CreateTvVertical1;
use App\Filament\Resources\TvVertical1s\Pages\EditTvVertical1;
use App\Filament\Resources\TvVertical1s\Pages\ListTvVertical1s;
use App\Filament\Resources\TvVertical1s\Schemas\TvVertical1Form;
use App\Filament\Resources\TvVertical1s\Tables\TvVertical1sTable;
use App\Models\TvVertical1;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\TvVertical1Importer;
use Filament\Actions\ImportAction;
use App\Filament\Exports\TvVertical1Exporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class TvVertical1Resource extends Resource
{
    protected static ?string $model = TvVertical1::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return TvVertical1Form::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return TvVertical1sTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(TvVertical1Importer::class),
ExportAction::make()->exporter(TvVertical1Exporter::class)
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
            'index' => ListTvVertical1s::route('/'),
            'create' => CreateTvVertical1::route('/create'),
            'edit' => EditTvVertical1::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'tvvertical1';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'TvVertical1';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
