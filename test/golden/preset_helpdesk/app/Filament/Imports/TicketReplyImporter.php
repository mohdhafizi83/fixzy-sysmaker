<?php

namespace App\Filament\Imports;

use App\Models\TicketReply;
use App\Models\Ticket;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class TicketReplyImporter extends Importer
{
    protected static ?string $model = TicketReply::class;

    public static function getColumns(): array
    {
        return [
            ImportColumn::make('id')
                ->label('ID')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('ID'),

            ImportColumn::make('created_at')
                ->label('Created At')
                ->ignoreBlankState()
                ->rules(['datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Created At'),

            ImportColumn::make('updated_at')
                ->label('Updated At')
                ->ignoreBlankState()
                ->rules(['datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Updated At'),

            ImportColumn::make('deleted_at')
                ->label('Deleted At')
                ->ignoreBlankState()
                ->rules(['datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Deleted At'),

            ImportColumn::make('created_by')
                ->label('Created By')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Created By'),

            ImportColumn::make('updated_by')
                ->label('Updated By')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Updated By'),

            ImportColumn::make('deleted_by')
                ->label('Deleted By')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Deleted By'),

            ImportColumn::make('ticket_id')
                ->label('Ticket')
                ->requiredMapping()
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['required', 'integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Ticket'),

            ImportColumn::make('reply_from')
                ->label('Reply From')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Reply From 1', 'Sample Reply From 2'])
                ->exampleHeader('Reply From'),

            ImportColumn::make('is_agent_reply')
                ->label('Agent Reply')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required'])
                ->examples(['1', '0'])
                ->exampleHeader('Agent Reply'),

            ImportColumn::make('message')
                ->label('Message')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required'])
                ->examples(['Sample Message 1', 'Sample Message 2'])
                ->exampleHeader('Message'),
        ];
    }

    public function resolveRecord(): ?TicketReply
    {
    return new TicketReply();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Ticket Replies import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

        if ($failedRowsCount = $import->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to import.';
        }

        return $body;
    }
    
    public static function getOptionsFormComponents(): array
    {
        return [
            Checkbox::make('updateExisting')
                ->label('Update existing records'),
        ];
    }

}
