<?php

namespace App\Filament\Resources\Syarikats;

use App\Filament\Resources\Syarikats\Pages\CreateSyarikat;
use App\Filament\Resources\Syarikats\Pages\EditSyarikat;
use App\Filament\Resources\Syarikats\Pages\ListSyarikats;
use App\Filament\Resources\Syarikats\Schemas\SyarikatForm;
use App\Filament\Resources\Syarikats\Tables\SyarikatsTable;
use App\Models\Syarikat;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\SyarikatImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\SyarikatExporter;
use Filament\Actions\ExportAction;

use App\Filament\Resources\Syarikats\RelationManagers\KontrakRelationManager;

use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class SyarikatResource extends Resource
{
    protected static ?string $model = Syarikat::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return SyarikatForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return SyarikatsTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(SyarikatImporter::class),
ExportAction::make()->exporter(SyarikatExporter::class)
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
                        KontrakRelationManager::class,
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
            'index' => ListSyarikats::route('/'),
            'create' => CreateSyarikat::route('/create'),
            'edit' => EditSyarikat::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'syarikat';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Syarikat';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
