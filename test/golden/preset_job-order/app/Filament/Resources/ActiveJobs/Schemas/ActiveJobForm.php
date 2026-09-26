<?php
namespace App\Filament\Resources\ActiveJobs\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;

class ActiveJobForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make("Active Jobs")
                ->columns(fn (Page $livewire) => $livewire->gridColumns ?? 2)
                ->schema([
				TextInput::make('id')
    ->integer()
    ->readOnly()
    ->maxLength(11)
    ->label('ID')
    ->trim(),
                TextInput::make('created_at')
    ->readOnly()
    ->label('Created At')
    ->trim(),
                TextInput::make('updated_at')
    ->readOnly()
    ->label('Updated At')
    ->trim(),
                TextInput::make('deleted_at')
    ->readOnly()
    ->label('Deleted At')
    ->trim(),
                TextInput::make('created_by')
    ->integer()
    ->readOnly()
    ->maxLength(20)
    ->label('Created By')
    ->trim(),
                TextInput::make('updated_by')
    ->integer()
    ->readOnly()
    ->maxLength(20)
    ->label('Updated By')
    ->trim(),
                TextInput::make('deleted_by')
    ->integer()
    ->readOnly()
    ->maxLength(20)
    ->label('Deleted By')
    ->trim(),
                TextInput::make('job_no')
    ->maxLength(30)
    ->required()->markAsRequired()
    ->unique(ignoreRecord: true)
    ->label('Job No')
    ->trim(),
                TextInput::make('title')
    ->maxLength(200)
    ->required()->markAsRequired()
    ->label('Job Title')
    ->trim(),
                TextInput::make('customer_name')
    ->maxLength(150)
    ->required()->markAsRequired()
    ->label('Customer')
    ->trim(),
                TextInput::make('customer_phone')
    ->maxLength(30)
    ->label('Customer Phone')
    ->trim(),
                Textarea::make('site_address')
    ->columnSpanFull()
    ->label('Site Address')
    ->trim(),
                TextInput::make('scheduled_date')
    ->label('Scheduled Date')
    ->trim(),
                TextInput::make('due_date')
    ->label('Due Date')
    ->trim(),
                TextInput::make('assigned_technician')
    ->maxLength(150)
    ->label('Assigned Technician')
    ->trim(),
                Select::make('job_status')
    ->default('scheduled')
    ->label('Status')
    ->options(['scheduled|in_progress|on_hold|completed|cancelled' => 'Scheduled|in Progress|on Hold|completed|cancelled'])
    ,
                Textarea::make('completion_notes')
    ->columnSpanFull()
    ->label('Completion Notes')
    ->trim(),
                ])
                ->columnSpanFull(),
        ]);
    }
}