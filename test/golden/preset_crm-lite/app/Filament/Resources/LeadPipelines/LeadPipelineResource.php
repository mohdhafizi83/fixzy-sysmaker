<?php

namespace App\Filament\Resources\LeadPipelines;

use App\Filament\Resources\LeadPipelines\Pages\CreateLeadPipeline;
use App\Filament\Resources\LeadPipelines\Pages\EditLeadPipeline;
use App\Filament\Resources\LeadPipelines\Pages\ListLeadPipelines;
use App\Filament\Resources\LeadPipelines\Schemas\LeadPipelineForm;
use App\Filament\Resources\LeadPipelines\Tables\LeadPipelinesTable;
use App\Models\Lead;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;


use App\Filament\Exports\LeadExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class LeadPipelineResource extends Resource
{
    protected static ?string $model = Lead::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return LeadPipelineForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return LeadPipelinesTable::configure($table)
		        ->headerActions([

ExportAction::make()->exporter(LeadExporter::class)
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
            'index' => ListLeadPipelines::route('/'),
            'create' => CreateLeadPipeline::route('/create'),
            'edit' => EditLeadPipeline::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'leadpipeline';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Lead';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Lead Pipeline';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'CRM';
    }

    
    public static function getNavigationSort(): int
    {
        return 3;
    }
}
