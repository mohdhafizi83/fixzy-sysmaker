<?php

namespace App\Filament\Resources\FakultiBoards;

use App\Filament\Resources\FakultiBoards\Pages\CreateFakultiBoard;
use App\Filament\Resources\FakultiBoards\Pages\EditFakultiBoard;
use App\Filament\Resources\FakultiBoards\Pages\ListFakultiBoards;
use App\Filament\Resources\FakultiBoards\Schemas\FakultiBoardForm;
use App\Filament\Resources\FakultiBoards\Tables\FakultiBoardsTable;
use App\Models\Fakulti;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;


use App\Filament\Exports\FakultiExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class FakultiBoardResource extends Resource
{
    protected static ?string $model = Fakulti::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return FakultiBoardForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return FakultiBoardsTable::configure($table)
		        ->headerActions([

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
            'index' => ListFakultiBoards::route('/'),
            'create' => CreateFakultiBoard::route('/create'),
            'edit' => EditFakultiBoard::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'fakultiboard';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Fakulti';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'FakultiBoard';
    }
	
    

    
}
