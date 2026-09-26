<?php

namespace App\Filament\Resources\Biliks;

use App\Filament\Resources\Biliks\Pages\CreateBilik;
use App\Filament\Resources\Biliks\Pages\EditBilik;
use App\Filament\Resources\Biliks\Pages\ListBiliks;
use App\Filament\Resources\Biliks\Schemas\BilikForm;
use App\Filament\Resources\Biliks\Tables\BiliksTable;
use App\Models\Bilik;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\BilikImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\BilikExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class BilikResource extends Resource
{
    protected static ?string $model = Bilik::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return BilikForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return BiliksTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(BilikImporter::class),
ExportAction::make()->exporter(BilikExporter::class)
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
            'index' => ListBiliks::route('/'),
            'create' => CreateBilik::route('/create'),
            'edit' => EditBilik::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'bilik';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Bilik';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Bilik';
    }
	
    

    
}
