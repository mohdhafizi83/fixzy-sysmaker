<?php

namespace App\Filament\Imports;

use App\Models\Job;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class JobImporter extends Importer
{
    protected static ?string $model = Job::class;

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

            ImportColumn::make('job_no')
                ->label('Job No')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:30'])
                ->examples(['Sample Job No 1', 'Sample Job No 2'])
                ->exampleHeader('Job No'),

            ImportColumn::make('title')
                ->label('Job Title')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:200'])
                ->examples(['Sample Job Title 1', 'Sample Job Title 2'])
                ->exampleHeader('Job Title'),

            ImportColumn::make('customer_name')
                ->label('Customer')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Customer 1', 'Sample Customer 2'])
                ->exampleHeader('Customer'),

            ImportColumn::make('customer_phone')
                ->label('Customer Phone')
                ->ignoreBlankState()
                ->rules(['max:30'])
                ->examples(['Sample Customer Phone 1', 'Sample Customer Phone 2'])
                ->exampleHeader('Customer Phone'),

            ImportColumn::make('site_address')
                ->label('Site Address')
                ->ignoreBlankState()
                ->examples(['Sample Site Address 1', 'Sample Site Address 2'])
                ->exampleHeader('Site Address'),

            ImportColumn::make('scheduled_date')
                ->label('Scheduled Date')
                ->ignoreBlankState()
                ->rules(['date'])
                ->examples(['2024-01-01', '2024-12-31'])
                ->exampleHeader('Scheduled Date'),

            ImportColumn::make('due_date')
                ->label('Due Date')
                ->ignoreBlankState()
                ->rules(['date'])
                ->examples(['2024-01-01', '2024-12-31'])
                ->exampleHeader('Due Date'),

            ImportColumn::make('assigned_technician')
                ->label('Assigned Technician')
                ->ignoreBlankState()
                ->rules(['max:150'])
                ->examples(['Sample Assigned Technician 1', 'Sample Assigned Technician 2'])
                ->exampleHeader('Assigned Technician'),

            ImportColumn::make('job_status')
                ->label('Status')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:30'])
                ->examples(['Sample Status 1', 'Sample Status 2'])
                ->exampleHeader('Status'),

            ImportColumn::make('completion_notes')
                ->label('Completion Notes')
                ->ignoreBlankState()
                ->examples(['Sample Completion Notes 1', 'Sample Completion Notes 2'])
                ->exampleHeader('Completion Notes'),
        ];
    }

    public function resolveRecord(): ?Job
    {
    
        return Job::firstOrNew([
            'job_no' => $this->data['job_no']
        ]);
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Jobs import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
