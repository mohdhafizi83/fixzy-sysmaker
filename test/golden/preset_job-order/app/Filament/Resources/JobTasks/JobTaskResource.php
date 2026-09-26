<?php

namespace App\Filament\Resources\JobTasks;

use App\Filament\Resources\JobTasks\Pages\CreateJobTask;
use App\Filament\Resources\JobTasks\Pages\EditJobTask;
use App\Filament\Resources\JobTasks\Pages\ListJobTasks;
use App\Filament\Resources\JobTasks\Schemas\JobTaskForm;
use App\Filament\Resources\JobTasks\Tables\JobTasksTable;
use App\Models\JobTask;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\JobTaskImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\JobTaskExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class JobTaskResource extends Resource
{
    protected static ?string $model = JobTask::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return JobTaskForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return JobTasksTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(JobTaskImporter::class),
ExportAction::make()->exporter(JobTaskExporter::class)
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
            'index' => ListJobTasks::route('/'),
            'create' => CreateJobTask::route('/create'),
            'edit' => EditJobTask::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'jobtasks';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'JobTask';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Job Tasks';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Work Orders';
    }

    
    public static function getNavigationSort(): int
    {
        return 1;
    }
}
