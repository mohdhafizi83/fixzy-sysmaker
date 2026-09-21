<?php

namespace App\Filament\Resources\PendaftaranKursuses;

use App\Filament\Resources\PendaftaranKursuses\Pages\CreatePendaftaranKursus;
use App\Filament\Resources\PendaftaranKursuses\Pages\EditPendaftaranKursus;
use App\Filament\Resources\PendaftaranKursuses\Pages\ListPendaftaranKursuses;
use App\Filament\Resources\PendaftaranKursuses\Schemas\PendaftaranKursusForm;
use App\Filament\Resources\PendaftaranKursuses\Tables\PendaftaranKursusesTable;
use App\Models\PendaftaranKursus;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\PendaftaranKursusImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\PendaftaranKursusExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class PendaftaranKursusResource extends Resource
{
    protected static ?string $model = PendaftaranKursus::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return PendaftaranKursusForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PendaftaranKursusesTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(PendaftaranKursusImporter::class),
ExportAction::make()->exporter(PendaftaranKursusExporter::class)
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
            'index' => ListPendaftaranKursuses::route('/'),
            'create' => CreatePendaftaranKursus::route('/create'),
            'edit' => EditPendaftaranKursus::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'pendaftarankursus';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'PendaftaranKursus';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pendaftaran Kursus';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Akademik';
    }

    
    public static function getNavigationSort(): int
    {
        return 1;
    }
}
