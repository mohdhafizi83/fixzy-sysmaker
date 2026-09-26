<?php

namespace App\Filament\Imports;

use App\Models\LeaveType;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class LeaveTypeImporter extends Importer
{
    protected static ?string $model = LeaveType::class;

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

            ImportColumn::make('type_name')
                ->label('Leave Type')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:100'])
                ->examples(['Sample Leave Type 1', 'Sample Leave Type 2'])
                ->exampleHeader('Leave Type'),

            ImportColumn::make('description')
                ->label('Description')
                ->ignoreBlankState()
                ->examples(['Sample Description 1', 'Sample Description 2'])
                ->exampleHeader('Description'),
        ];
    }

    public function resolveRecord(): ?LeaveType
    {
    return new LeaveType();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Leave Types import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
