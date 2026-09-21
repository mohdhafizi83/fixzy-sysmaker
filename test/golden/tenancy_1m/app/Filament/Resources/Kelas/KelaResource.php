<?php

namespace App\Filament\Resources\Kelas;

use App\Filament\Resources\Kelas\Pages\CreateKela;
use App\Filament\Resources\Kelas\Pages\EditKela;
use App\Filament\Resources\Kelas\Pages\ListKelas;
use App\Filament\Resources\Kelas\Schemas\KelaForm;
use App\Filament\Resources\Kelas\Tables\KelasTable;
use App\Models\Kela;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\KelaImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\KelaExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class KelaResource extends Resource
{
    protected static ?string $model = Kela::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where('sekolah_id', auth()->user()->sekolah_id);
    }

    public static function form(Schema $schema): Schema
    {
        return KelaForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return KelasTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(KelaImporter::class),
ExportAction::make()->exporter(KelaExporter::class)
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
            'index' => ListKelas::route('/'),
            'create' => CreateKela::route('/create'),
            'edit' => EditKela::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'kelas';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Kela';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pelajar Fakulti Ekonomi';
    }
	
    

    
}
