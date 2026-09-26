<?php

namespace App\Filament\Resources\TicketReplies;

use App\Filament\Resources\TicketReplies\Pages\CreateTicketReply;
use App\Filament\Resources\TicketReplies\Pages\EditTicketReply;
use App\Filament\Resources\TicketReplies\Pages\ListTicketReplies;
use App\Filament\Resources\TicketReplies\Schemas\TicketReplyForm;
use App\Filament\Resources\TicketReplies\Tables\TicketRepliesTable;
use App\Models\TicketReply;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\TicketReplyImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\TicketReplyExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class TicketReplyResource extends Resource
{
    protected static ?string $model = TicketReply::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return TicketReplyForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return TicketRepliesTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(TicketReplyImporter::class),
ExportAction::make()->exporter(TicketReplyExporter::class)
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
            'index' => ListTicketReplies::route('/'),
            'create' => CreateTicketReply::route('/create'),
            'edit' => EditTicketReply::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'ticketreplies';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'TicketReply';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Ticket Replies';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Helpdesk';
    }

    
    public static function getNavigationSort(): int
    {
        return 1;
    }
}
