<?php

namespace App\Filament\Imports;

use App\Models\LeaveRequest;
use App\Models\LeaveType;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class LeaveRequestImporter extends Importer
{
    protected static ?string $model = LeaveRequest::class;

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

            ImportColumn::make('employee_name')
                ->label('Employee Name')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Employee Name 1', 'Sample Employee Name 2'])
                ->exampleHeader('Employee Name'),

            ImportColumn::make('employee_email')
                ->label('Employee Email')
                ->ignoreBlankState()
                ->rules(['max:150'])
                ->examples(['Sample Employee Email 1', 'Sample Employee Email 2'])
                ->exampleHeader('Employee Email'),

            ImportColumn::make('leave_type_id')
                ->label('Leave Type')
                ->requiredMapping()
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['required', 'integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Leave Type'),

            ImportColumn::make('start_date')
                ->label('Start Date')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'date'])
                ->examples(['2024-01-01', '2024-12-31'])
                ->exampleHeader('Start Date'),

            ImportColumn::make('end_date')
                ->label('End Date')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'date'])
                ->examples(['2024-01-01', '2024-12-31'])
                ->exampleHeader('End Date'),

            ImportColumn::make('days_requested')
                ->label('Days Requested')
                ->numeric()
                ->ignoreBlankState()
                ->rules(['max:8'])
                ->examples(['Sample Days Requested 1', 'Sample Days Requested 2'])
                ->exampleHeader('Days Requested'),

            ImportColumn::make('reason')
                ->label('Reason')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required'])
                ->examples(['Sample Reason 1', 'Sample Reason 2'])
                ->exampleHeader('Reason'),

            ImportColumn::make('approval_status')
                ->label('Status')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:30'])
                ->examples(['Sample Status 1', 'Sample Status 2'])
                ->exampleHeader('Status'),
        ];
    }

    public function resolveRecord(): ?LeaveRequest
    {
    return new LeaveRequest();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Leave Requests import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
