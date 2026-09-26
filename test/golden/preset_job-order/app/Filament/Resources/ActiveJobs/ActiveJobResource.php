<?php

namespace App\Filament\Resources\ActiveJobs;

use App\Filament\Resources\ActiveJobs\Pages\CreateActiveJob;
use App\Filament\Resources\ActiveJobs\Pages\EditActiveJob;
use App\Filament\Resources\ActiveJobs\Pages\ListActiveJobs;
use App\Filament\Resources\ActiveJobs\Schemas\ActiveJobForm;
use App\Filament\Resources\ActiveJobs\Tables\ActiveJobsTable;
use App\Models\Job;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;


use App\Filament\Exports\JobExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class ActiveJobResource extends Resource
{
    protected static ?string $model = Job::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where(function($q) {
            $q->whereIn('job_status', ['scheduled', 'in_progress', 'on_hold']);
            });
    }

    public static function form(Schema $schema): Schema
    {
        return ActiveJobForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ActiveJobsTable::configure($table)
		        ->headerActions([

ExportAction::make()->exporter(JobExporter::class)
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
            'index' => ListActiveJobs::route('/'),
            'create' => CreateActiveJob::route('/create'),
            'edit' => EditActiveJob::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'activejobs';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Job';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Active Jobs';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Work Orders';
    }

    
    public static function getNavigationSort(): int
    {
        return 2;
    }
}
