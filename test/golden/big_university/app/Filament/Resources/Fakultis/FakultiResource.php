<?php

namespace App\Filament\Resources\Fakultis;

use App\Filament\Resources\Fakultis\Pages\CreateFakulti;
use App\Filament\Resources\Fakultis\Pages\EditFakulti;
use App\Filament\Resources\Fakultis\Pages\ListFakultis;
use App\Filament\Resources\Fakultis\Schemas\FakultiForm;
use App\Filament\Resources\Fakultis\Tables\FakultisTable;
use App\Models\Fakulti;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\FakultiImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\FakultiExporter;
use Filament\Actions\ExportAction;

use App\Filament\Resources\Fakultis\RelationManagers\PelajarRelationManager;
use App\Filament\Resources\Fakultis\RelationManagers\InvoiceRelationManager;
use App\Filament\RelationManagers\AuditsRelationManager;

class FakultiResource extends Resource
{
    protected static ?string $model = Fakulti::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?int $navigationSort = 6;
    
    

    public static function form(Schema $schema): Schema
    {
        return FakultiForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return FakultisTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(FakultiImporter::class),
ExportAction::make()->exporter(FakultiExporter::class)
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
                        PelajarRelationManager::class,
            InvoiceRelationManager::class,
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
            'index' => ListFakultis::route('/'),
            'create' => CreateFakulti::route('/create'),
            'edit' => EditFakulti::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'fakulti';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Fakulti';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'fakulti';
    }
	
    

    
}
