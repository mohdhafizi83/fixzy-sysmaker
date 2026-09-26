<?php

namespace App\Filament\Imports;

use App\Models\Contact;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class ContactImporter extends Importer
{
    protected static ?string $model = Contact::class;

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

            ImportColumn::make('full_name')
                ->label('Full Name')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Full Name 1', 'Sample Full Name 2'])
                ->exampleHeader('Full Name'),

            ImportColumn::make('company')
                ->label('Company')
                ->ignoreBlankState()
                ->rules(['max:150'])
                ->examples(['Sample Company 1', 'Sample Company 2'])
                ->exampleHeader('Company'),

            ImportColumn::make('email')
                ->label('Email')
                ->ignoreBlankState()
                ->rules(['max:150'])
                ->examples(['Sample Email 1', 'Sample Email 2'])
                ->exampleHeader('Email'),

            ImportColumn::make('phone')
                ->label('Phone')
                ->ignoreBlankState()
                ->rules(['max:30'])
                ->examples(['Sample Phone 1', 'Sample Phone 2'])
                ->exampleHeader('Phone'),

            ImportColumn::make('job_title')
                ->label('Job Title')
                ->ignoreBlankState()
                ->rules(['max:100'])
                ->examples(['Sample Job Title 1', 'Sample Job Title 2'])
                ->exampleHeader('Job Title'),

            ImportColumn::make('notes')
                ->label('Notes')
                ->ignoreBlankState()
                ->examples(['Sample Notes 1', 'Sample Notes 2'])
                ->exampleHeader('Notes'),
        ];
    }

    public function resolveRecord(): ?Contact
    {
    return new Contact();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $body = 'Your Contacts import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' imported.';

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
