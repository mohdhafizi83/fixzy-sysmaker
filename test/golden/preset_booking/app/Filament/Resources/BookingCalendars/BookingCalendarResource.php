<?php

namespace App\Filament\Resources\BookingCalendars;

use App\Filament\Resources\BookingCalendars\Pages\CreateBookingCalendar;
use App\Filament\Resources\BookingCalendars\Pages\EditBookingCalendar;
use App\Filament\Resources\BookingCalendars\Pages\ListBookingCalendars;
use App\Filament\Resources\BookingCalendars\Schemas\BookingCalendarForm;
use App\Filament\Resources\BookingCalendars\Tables\BookingCalendarsTable;
use App\Models\Booking;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;


use App\Filament\Exports\BookingExporter;
use Filament\Actions\ExportAction;


use App\Filament\RelationManagers\AuditsRelationManager;

class BookingCalendarResource extends Resource
{
    protected static ?string $model = Booking::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    

    public static function form(Schema $schema): Schema
    {
        return BookingCalendarForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return BookingCalendarsTable::configure($table)
		        ->headerActions([

ExportAction::make()->exporter(BookingExporter::class)
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
            'index' => ListBookingCalendars::route('/'),
            'create' => CreateBookingCalendar::route('/create'),
            'edit' => EditBookingCalendar::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'bookingcalendar';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Booking';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Booking Calendar';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Bookings';
    }

    
    public static function getNavigationSort(): int
    {
        return 2;
    }
}
