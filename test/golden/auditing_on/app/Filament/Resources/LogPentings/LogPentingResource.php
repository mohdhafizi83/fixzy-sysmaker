<?php

namespace App\Filament\Resources\LogPentings;

use App\Filament\Resources\LogPentings\Pages\CreateLogPenting;
use App\Filament\Resources\LogPentings\Pages\EditLogPenting;
use App\Filament\Resources\LogPentings\Pages\ListLogPentings;
use App\Filament\Resources\LogPentings\Schemas\LogPentingForm;
use App\Filament\Resources\LogPentings\Tables\LogPentingsTable;
use App\Models\LogPenting;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\LogPentingImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\LogPentingExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class LogPentingResource extends Resource
{
    protected static ?string $model = LogPenting::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return LogPentingForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return LogPentingsTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(LogPentingImporter::class),
ExportAction::make()->exporter(LogPentingExporter::class)
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
            'index' => ListLogPentings::route('/'),
            'create' => CreateLogPenting::route('/create'),
            'edit' => EditLogPenting::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'logpenting';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'LogPenting';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
