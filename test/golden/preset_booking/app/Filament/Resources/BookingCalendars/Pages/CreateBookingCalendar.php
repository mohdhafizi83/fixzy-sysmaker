<?php

namespace App\Filament\Resources\BookingCalendars\Pages;

use App\Filament\Resources\BookingCalendars\BookingCalendarResource;
use Filament\Resources\Pages\CreateRecord;

class CreateBookingCalendar extends CreateRecord
{
    protected static string $resource = BookingCalendarResource::class;

    public int $gridColumns = 2;
    
    protected function getHeaderActions(): array
    {
        return [
            $this->getCreateFormAction()
                 ->formId('form'),
            $this->getCreateAnotherFormAction()
                 ->formId('form'),
            $this->getCancelFormAction(),
        ];
    }
    
    

    protected function getFormActions(): array
    {
        return [];
    }
}