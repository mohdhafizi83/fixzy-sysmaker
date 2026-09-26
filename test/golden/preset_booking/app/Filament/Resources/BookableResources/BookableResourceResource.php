<?php

namespace App\Filament\Resources\BookableResources;

use App\Filament\Resources\BookableResources\Pages\CreateBookableResource;
use App\Filament\Resources\BookableResources\Pages\EditBookableResource;
use App\Filament\Resources\BookableResources\Pages\ListBookableResources;
use App\Filament\Resources\BookableResources\Schemas\BookableResourceForm;
use App\Filament\Resources\BookableResources\Tables\BookableResourcesTable;
use App\Models\BookableResource;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\BookableResourceImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\BookableResourceExporter;
use Filament\Actions\ExportAction;

use App\Filament\Resources\BookableResources\RelationManagers\BookingRelationManager;
use App\Filament\RelationManagers\AuditsRelationManager;

class BookableResourceResource extends Resource
{
    protected static ?string $model = BookableResource::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return BookableResourceForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return BookableResourcesTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(BookableResourceImporter::class),
ExportAction::make()->exporter(BookableResourceExporter::class)
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
                        BookingRelationManager::class,
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
            'index' => ListBookableResources::route('/'),
            'create' => CreateBookableResource::route('/create'),
            'edit' => EditBookableResource::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'bookableresources';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'BookableResource';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Bookable Resources';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Bookings';
    }

    
    public static function getNavigationSort(): int
    {
        return 0;
    }
}
