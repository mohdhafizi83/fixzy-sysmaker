<?php

namespace App\Filament\Imports;

use App\Models\BookableResource;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class BookableResourceImporter extends Importer
{
    protected static ?string $model = BookableResource::class;

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

            ImportColumn::make('resource_name')
                ->label('Resource Name')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Resource Name 1', 'Sample Resource Name 2'])
                ->exampleHeader('Resource Name'),

            ImportColumn::make('resource_code')
                ->label('Resource Code')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:30'])
                ->examples(['Sample Resource Code 1', 'Sample Resource Code 2'])
                ->exampleHeader('Resource Code'),

            ImportColumn::make('capacity')
                ->label('Capacity')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Capacity'),

            ImportColumn::make('location')
                ->label('Location')
                ->ignoreBlankState()
                ->rules(['max:150'])
                ->examples(['Sample Location 1', 'Sample Location 2'])
                ->exampleHeader('Location'),

            ImportColumn::make('is_active')
                ->label('Active')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required'])
                ->examples(['1', '0'])
                ->exampleHeader('Active'),
        ];
    }

    public function resolveRecord(): ?BookableResource
    {
    
        return BookableResource::firstOrNew([
            'resource_code' => $this->data['resource_code']
        ]);
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Bookable Resources import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
