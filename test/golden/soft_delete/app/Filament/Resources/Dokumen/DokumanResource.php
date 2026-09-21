<?php

namespace App\Filament\Resources\Dokumen;

use App\Filament\Resources\Dokumen\Pages\CreateDokuman;
use App\Filament\Resources\Dokumen\Pages\EditDokuman;
use App\Filament\Resources\Dokumen\Pages\ListDokumen;
use App\Filament\Resources\Dokumen\Schemas\DokumanForm;
use App\Filament\Resources\Dokumen\Tables\DokumenTable;
use App\Models\Dokuman;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\DokumanImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\DokumanExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class DokumanResource extends Resource
{
    protected static ?string $model = Dokuman::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return DokumanForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return DokumenTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(DokumanImporter::class),
ExportAction::make()->exporter(DokumanExporter::class)
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
            'index' => ListDokumen::route('/'),
            'create' => CreateDokuman::route('/create'),
            'edit' => EditDokuman::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'dokumen';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Dokuman';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
