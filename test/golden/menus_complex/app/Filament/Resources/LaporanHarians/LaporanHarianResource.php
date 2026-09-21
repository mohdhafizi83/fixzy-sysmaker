<?php

namespace App\Filament\Resources\LaporanHarians;

use App\Filament\Resources\LaporanHarians\Pages\CreateLaporanHarian;
use App\Filament\Resources\LaporanHarians\Pages\EditLaporanHarian;
use App\Filament\Resources\LaporanHarians\Pages\ListLaporanHarians;
use App\Filament\Resources\LaporanHarians\Schemas\LaporanHarianForm;
use App\Filament\Resources\LaporanHarians\Tables\LaporanHariansTable;
use App\Models\LaporanHarian;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\LaporanHarianImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\LaporanHarianExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class LaporanHarianResource extends Resource
{
    protected static ?string $model = LaporanHarian::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return LaporanHarianForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return LaporanHariansTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(LaporanHarianImporter::class),
ExportAction::make()->exporter(LaporanHarianExporter::class)
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
            'index' => ListLaporanHarians::route('/'),
            'create' => CreateLaporanHarian::route('/create'),
            'edit' => EditLaporanHarian::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'laporanharian';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'LaporanHarian';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
