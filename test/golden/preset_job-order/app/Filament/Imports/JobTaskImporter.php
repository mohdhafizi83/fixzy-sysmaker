<?php

namespace App\Filament\Imports;

use App\Models\JobTask;
use App\Models\Job;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class JobTaskImporter extends Importer
{
    protected static ?string $model = JobTask::class;

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

            ImportColumn::make('job_id')
                ->label('Job')
                ->requiredMapping()
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['required', 'integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Job'),

            ImportColumn::make('task_name')
                ->label('Task')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:200'])
                ->examples(['Sample Task 1', 'Sample Task 2'])
                ->exampleHeader('Task'),

            ImportColumn::make('task_order')
                ->label('Order')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Order'),

            ImportColumn::make('is_done')
                ->label('Done')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required'])
                ->examples(['1', '0'])
                ->exampleHeader('Done'),

            ImportColumn::make('notes')
                ->label('Notes')
                ->ignoreBlankState()
                ->examples(['Sample Notes 1', 'Sample Notes 2'])
                ->exampleHeader('Notes'),
        ];
    }

    public function resolveRecord(): ?JobTask
    {
    return new JobTask();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Job Tasks import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
