<?php

namespace App\Filament\Resources\UrgentTickets;

use App\Filament\Resources\UrgentTickets\Pages\CreateUrgentTicket;
use App\Filament\Resources\UrgentTickets\Pages\EditUrgentTicket;
use App\Filament\Resources\UrgentTickets\Pages\ListUrgentTickets;
use App\Filament\Resources\UrgentTickets\Schemas\UrgentTicketForm;
use App\Filament\Resources\UrgentTickets\Tables\UrgentTicketsTable;
use App\Models\Ticket;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;


use App\Filament\Exports\TicketExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class UrgentTicketResource extends Resource
{
    protected static ?string $model = Ticket::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where(function($q) {
            $q->where('priority', '=', 'urgent');
            });
    }

    public static function form(Schema $schema): Schema
    {
        return UrgentTicketForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return UrgentTicketsTable::configure($table)
		        ->headerActions([

ExportAction::make()->exporter(TicketExporter::class)
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
            'index' => ListUrgentTickets::route('/'),
            'create' => CreateUrgentTicket::route('/create'),
            'edit' => EditUrgentTicket::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'urgenttickets';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Ticket';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Urgent Tickets';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Helpdesk';
    }

    
    public static function getNavigationSort(): int
    {
        return 3;
    }
}
