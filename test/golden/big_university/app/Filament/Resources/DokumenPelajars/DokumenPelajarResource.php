<?php

namespace App\Filament\Resources\DokumenPelajars;

use App\Filament\Resources\DokumenPelajars\Pages\CreateDokumenPelajar;
use App\Filament\Resources\DokumenPelajars\Pages\EditDokumenPelajar;
use App\Filament\Resources\DokumenPelajars\Pages\ListDokumenPelajars;
use App\Filament\Resources\DokumenPelajars\Schemas\DokumenPelajarForm;
use App\Filament\Resources\DokumenPelajars\Tables\DokumenPelajarsTable;
use App\Models\DokumenPelajar;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\DokumenPelajarImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\DokumenPelajarExporter;
use Filament\Actions\ExportAction;



use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class DokumenPelajarResource extends Resource
{
    protected static ?string $model = DokumenPelajar::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return DokumenPelajarForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return DokumenPelajarsTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(DokumenPelajarImporter::class),
ExportAction::make()->exporter(DokumenPelajarExporter::class)
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
            'index' => ListDokumenPelajars::route('/'),
            'create' => CreateDokumenPelajar::route('/create'),
            'edit' => EditDokumenPelajar::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'dokumenpelajar';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'DokumenPelajar';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Dokumen Pelajar';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Biodata';
    }

    
    public static function getNavigationSort(): int
    {
        return 2;
    }
}
