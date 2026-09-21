<?php

namespace App\Filament\Resources\Kontraks;

use App\Filament\Resources\Kontraks\Pages\CreateKontrak;
use App\Filament\Resources\Kontraks\Pages\EditKontrak;
use App\Filament\Resources\Kontraks\Pages\ListKontraks;
use App\Filament\Resources\Kontraks\Schemas\KontrakForm;
use App\Filament\Resources\Kontraks\Tables\KontraksTable;
use App\Models\Kontrak;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\KontrakImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\KontrakExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class KontrakResource extends Resource
{
    protected static ?string $model = Kontrak::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where('syarikat_id', auth()->user()->syarikat_id);
    }

    public static function form(Schema $schema): Schema
    {
        return KontrakForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return KontraksTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(KontrakImporter::class),
ExportAction::make()->exporter(KontrakExporter::class)
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
            'index' => ListKontraks::route('/'),
            'create' => CreateKontrak::route('/create'),
            'edit' => EditKontrak::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'kontrak';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Kontrak';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
