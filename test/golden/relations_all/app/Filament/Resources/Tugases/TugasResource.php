<?php

namespace App\Filament\Resources\Tugases;

use App\Filament\Resources\Tugases\Pages\CreateTugas;
use App\Filament\Resources\Tugases\Pages\EditTugas;
use App\Filament\Resources\Tugases\Pages\ListTugases;
use App\Filament\Resources\Tugases\Schemas\TugasForm;
use App\Filament\Resources\Tugases\Tables\TugasesTable;
use App\Models\Tugas;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\TugasImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\TugasExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class TugasResource extends Resource
{
    protected static ?string $model = Tugas::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return TugasForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return TugasesTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(TugasImporter::class),
ExportAction::make()->exporter(TugasExporter::class)
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
		

    // Hanya tambah AuditsRelationManager jika pengguna boleh melihatnya
    
        if (auth()->check() && auth()->user()->can('view_any_audit')) {
            $relations[] = AuditsRelationManager::class;
        }
	
	return $relations;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListTugases::route('/'),
            'create' => CreateTugas::route('/create'),
            'edit' => EditTugas::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'tugas';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Tugas';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
