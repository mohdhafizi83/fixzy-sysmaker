<?php

namespace App\Filament\Imports;

use App\Models\Activity;
use App\Models\Lead;
use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class ActivityImporter extends Importer
{
    protected static ?string $model = Activity::class;

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

            ImportColumn::make('lead_id')
                ->label('Lead')
                ->requiredMapping()
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['required', 'integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Lead'),

            ImportColumn::make('activity_type')
                ->label('Type')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:30'])
                ->examples(['Sample Type 1', 'Sample Type 2'])
                ->exampleHeader('Type'),

            ImportColumn::make('activity_date')
                ->label('Date')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'datetime'])
                ->examples(['2024-01-01 22:56:00', '2024-12-31 22:56:00'])
                ->exampleHeader('Date'),

            ImportColumn::make('summary')
                ->label('Summary')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:200'])
                ->examples(['Sample Summary 1', 'Sample Summary 2'])
                ->exampleHeader('Summary'),

            ImportColumn::make('details')
                ->label('Details')
                ->ignoreBlankState()
                ->examples(['Sample Details 1', 'Sample Details 2'])
                ->exampleHeader('Details'),
        ];
    }

    public function resolveRecord(): ?Activity
    {
    return new Activity();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Activities import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
