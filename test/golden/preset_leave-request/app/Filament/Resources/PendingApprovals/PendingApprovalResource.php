<?php

namespace App\Filament\Resources\PendingApprovals;

use App\Filament\Resources\PendingApprovals\Pages\CreatePendingApproval;
use App\Filament\Resources\PendingApprovals\Pages\EditPendingApproval;
use App\Filament\Resources\PendingApprovals\Pages\ListPendingApprovals;
use App\Filament\Resources\PendingApprovals\Schemas\PendingApprovalForm;
use App\Filament\Resources\PendingApprovals\Tables\PendingApprovalsTable;
use App\Models\LeaveRequest;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;


use App\Filament\Exports\LeaveRequestExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;
use App\Filament\RelationManagers\ApprovalHistoryRelationManager;

class PendingApprovalResource extends Resource
{
    protected static ?string $model = LeaveRequest::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where(function($q) {
            $q->whereIn('approval_status', ['pending', 'manager_review']);
            });
    }

    public static function form(Schema $schema): Schema
    {
        return PendingApprovalForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PendingApprovalsTable::configure($table)
		        ->headerActions([

ExportAction::make()->exporter(LeaveRequestExporter::class)
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
        $relations[] = ApprovalHistoryRelationManager::class;
	
	return $relations;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListPendingApprovals::route('/'),
            'create' => CreatePendingApproval::route('/create'),
            'edit' => EditPendingApproval::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'pendingapprovals';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'LeaveRequest';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pending Approvals';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Leave';
    }

    
    public static function getNavigationSort(): int
    {
        return 2;
    }
}
