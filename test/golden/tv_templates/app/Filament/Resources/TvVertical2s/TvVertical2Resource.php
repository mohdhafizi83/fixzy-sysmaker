<?php

namespace App\Filament\Resources\TvVertical2s;

use App\Filament\Resources\TvVertical2s\Pages\CreateTvVertical2;
use App\Filament\Resources\TvVertical2s\Pages\EditTvVertical2;
use App\Filament\Resources\TvVertical2s\Pages\ListTvVertical2s;
use App\Filament\Resources\TvVertical2s\Schemas\TvVertical2Form;
use App\Filament\Resources\TvVertical2s\Tables\TvVertical2sTable;
use App\Models\TvVertical2;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\TvVertical2Importer;
use Filament\Actions\ImportAction;
use App\Filament\Exports\TvVertical2Exporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class TvVertical2Resource extends Resource
{
    protected static ?string $model = TvVertical2::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return TvVertical2Form::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return TvVertical2sTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(TvVertical2Importer::class),
ExportAction::make()->exporter(TvVertical2Exporter::class)
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
            'index' => ListTvVertical2s::route('/'),
            'create' => CreateTvVertical2::route('/create'),
            'edit' => EditTvVertical2::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'tvvertical2';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'TvVertical2';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
