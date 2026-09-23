<?php

namespace App\Filament\Resources\Kursuses;

use App\Filament\Resources\Kursuses\Pages\CreateKursus;
use App\Filament\Resources\Kursuses\Pages\EditKursus;
use App\Filament\Resources\Kursuses\Pages\ListKursuses;
use App\Filament\Resources\Kursuses\Schemas\KursusForm;
use App\Filament\Resources\Kursuses\Tables\KursusesTable;
use App\Models\Kursus;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\KursusImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\KursusExporter;
use Filament\Actions\ExportAction;

use App\Filament\Resources\Kursuses\RelationManagers\KursusRelationManager;
use App\Filament\Resources\Kursuses\RelationManagers\PendaftaranKursusRelationManager;
use App\Filament\RelationManagers\AuditsRelationManager;

class KursusResource extends Resource
{
    protected static ?string $model = Kursus::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return KursusForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return KursusesTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(KursusImporter::class),
ExportAction::make()->exporter(KursusExporter::class)
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
                        KursusRelationManager::class,
            PendaftaranKursusRelationManager::class,
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
            'index' => ListKursuses::route('/'),
            'create' => CreateKursus::route('/create'),
            'edit' => EditKursus::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'kursus';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Kursus';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Kursus';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Akademik';
    }

    
    public static function getNavigationSort(): int
    {
        return 0;
    }
}
