<?php

namespace App\Filament\Resources\LaporanBulanans;

use App\Filament\Resources\LaporanBulanans\Pages\CreateLaporanBulanan;
use App\Filament\Resources\LaporanBulanans\Pages\EditLaporanBulanan;
use App\Filament\Resources\LaporanBulanans\Pages\ListLaporanBulanans;
use App\Filament\Resources\LaporanBulanans\Schemas\LaporanBulananForm;
use App\Filament\Resources\LaporanBulanans\Tables\LaporanBulanansTable;
use App\Models\LaporanBulanan;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\LaporanBulananImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\LaporanBulananExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class LaporanBulananResource extends Resource
{
    protected static ?string $model = LaporanBulanan::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return LaporanBulananForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return LaporanBulanansTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(LaporanBulananImporter::class),
ExportAction::make()->exporter(LaporanBulananExporter::class)
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
            'index' => ListLaporanBulanans::route('/'),
            'create' => CreateLaporanBulanan::route('/create'),
            'edit' => EditLaporanBulanan::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'laporanbulanan';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'LaporanBulanan';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
