<?php

namespace App\Filament\Resources\Pelajars;

use App\Filament\Resources\Pelajars\Pages\CreatePelajar;
use App\Filament\Resources\Pelajars\Pages\EditPelajar;
use App\Filament\Resources\Pelajars\Pages\ListPelajars;
use App\Filament\Resources\Pelajars\Schemas\PelajarForm;
use App\Filament\Resources\Pelajars\Tables\PelajarsTable;
use App\Models\Pelajar;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\PelajarImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\PelajarExporter;
use Filament\Actions\ExportAction;

use App\Filament\Resources\Pelajars\RelationManagers\DokumenPelajarRelationManager;
use App\Filament\Resources\Pelajars\RelationManagers\PendaftaranKursusRelationManager;
use App\Filament\Resources\Pelajars\RelationManagers\KeputusanUjianRelationManager;

use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class PelajarResource extends Resource
{
    protected static ?string $model = Pelajar::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCount(['dokumenPelajars'])
            ->where('created_by', auth()->id());
    }

    public static function form(Schema $schema): Schema
    {
        return PelajarForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PelajarsTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(PelajarImporter::class),
ExportAction::make()->exporter(PelajarExporter::class)
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
                        DokumenPelajarRelationManager::class,
            PendaftaranKursusRelationManager::class,
            KeputusanUjianRelationManager::class,
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
            'index' => ListPelajars::route('/'),
            'create' => CreatePelajar::route('/create'),
            'edit' => EditPelajar::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'pelajar';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Pelajar';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Biodata';
    }

    
    public static function getNavigationSort(): int
    {
        return 0;
    }
}
