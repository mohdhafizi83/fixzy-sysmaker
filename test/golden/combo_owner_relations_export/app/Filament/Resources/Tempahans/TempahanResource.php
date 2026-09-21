<?php

namespace App\Filament\Resources\Tempahans;

use App\Filament\Resources\Tempahans\Pages\CreateTempahan;
use App\Filament\Resources\Tempahans\Pages\EditTempahan;
use App\Filament\Resources\Tempahans\Pages\ListTempahans;
use App\Filament\Resources\Tempahans\Schemas\TempahanForm;
use App\Filament\Resources\Tempahans\Tables\TempahansTable;
use App\Models\Tempahan;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\TempahanImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\TempahanExporter;
use Filament\Actions\ExportAction;

use App\Filament\Resources\Tempahans\RelationManagers\ItemTempahanRelationManager;
use App\Filament\RelationManagers\AuditsRelationManager;

class TempahanResource extends Resource
{
    protected static ?string $model = Tempahan::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCount(['itemTempahans'])
            ->where('created_by', auth()->id());
    }

    public static function form(Schema $schema): Schema
    {
        return TempahanForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return TempahansTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(TempahanImporter::class),
ExportAction::make()->exporter(TempahanExporter::class)
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
                        ItemTempahanRelationManager::class,
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
            'index' => ListTempahans::route('/'),
            'create' => CreateTempahan::route('/create'),
            'edit' => EditTempahan::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'tempahan';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Tempahan';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
