<?php

namespace App\Filament\Resources\TvCards;

use App\Filament\Resources\TvCards\Pages\CreateTvCard;
use App\Filament\Resources\TvCards\Pages\EditTvCard;
use App\Filament\Resources\TvCards\Pages\ListTvCards;
use App\Filament\Resources\TvCards\Schemas\TvCardForm;
use App\Filament\Resources\TvCards\Tables\TvCardsTable;
use App\Models\TvCard;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\TvCardImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\TvCardExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class TvCardResource extends Resource
{
    protected static ?string $model = TvCard::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return TvCardForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return TvCardsTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(TvCardImporter::class),
ExportAction::make()->exporter(TvCardExporter::class)
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
            'index' => ListTvCards::route('/'),
            'create' => CreateTvCard::route('/create'),
            'edit' => EditTvCard::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'tvcard';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'TvCard';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
