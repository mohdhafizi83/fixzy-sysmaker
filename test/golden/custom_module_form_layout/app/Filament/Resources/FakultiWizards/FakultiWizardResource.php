<?php

namespace App\Filament\Resources\FakultiWizards;

use App\Filament\Resources\FakultiWizards\Pages\CreateFakultiWizard;
use App\Filament\Resources\FakultiWizards\Pages\EditFakultiWizard;
use App\Filament\Resources\FakultiWizards\Pages\ListFakultiWizards;
use App\Filament\Resources\FakultiWizards\Schemas\FakultiWizardForm;
use App\Filament\Resources\FakultiWizards\Tables\FakultiWizardsTable;
use App\Models\Fakulti;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;


use App\Filament\Exports\FakultiExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class FakultiWizardResource extends Resource
{
    protected static ?string $model = Fakulti::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?int $navigationSort = 9;
    
    
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where(function($q) {
            $q->where('kod_fakulti', '!=', 'X');
            });
    }

    public static function form(Schema $schema): Schema
    {
        return FakultiWizardForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return FakultiWizardsTable::configure($table)
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
            'index' => ListFakultiWizards::route('/'),
            'create' => CreateFakultiWizard::route('/create'),
            'edit' => EditFakultiWizard::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'fakultiwizard';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Fakulti';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'FakultiRingkas';
    }
	
    

    
}
