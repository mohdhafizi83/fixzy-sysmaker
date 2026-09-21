<?php

namespace App\Filament\Resources\SemuaFields;

use App\Filament\Resources\SemuaFields\Pages\CreateSemuaField;
use App\Filament\Resources\SemuaFields\Pages\EditSemuaField;
use App\Filament\Resources\SemuaFields\Pages\ListSemuaFields;
use App\Filament\Resources\SemuaFields\Schemas\SemuaFieldForm;
use App\Filament\Resources\SemuaFields\Tables\SemuaFieldsTable;
use App\Models\SemuaField;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\SemuaFieldImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\SemuaFieldExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class SemuaFieldResource extends Resource
{
    protected static ?string $model = SemuaField::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return SemuaFieldForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return SemuaFieldsTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(SemuaFieldImporter::class),
ExportAction::make()->exporter(SemuaFieldExporter::class)
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
            'index' => ListSemuaFields::route('/'),
            'create' => CreateSemuaField::route('/create'),
            'edit' => EditSemuaField::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'semuafield';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'SemuaField';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
