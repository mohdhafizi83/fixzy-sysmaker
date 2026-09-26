<?php
namespace App\Filament\Resources\PendingApprovals\Schemas;



use Illuminate\Contracts\View\View;
use Filament\Schemas\Schema;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;

class PendingApprovalForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make("Pending Approvals")
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
                TextInput::make('employee_name')
    ->maxLength(150)
    ->required()->markAsRequired()
    ->label('Employee Name')
    ->trim(),
                TextInput::make('employee_email')
    ->maxLength(150)
    ->label('Employee Email')
    ->trim(),
                TextInput::make('leave_type_id')
    ->integer()
    ->required()->markAsRequired()
    ->label('Leave Type')
    ->trim(),
                TextInput::make('start_date')
    ->required()->markAsRequired()
    ->label('Start Date')
    ->trim(),
                TextInput::make('end_date')
    ->required()->markAsRequired()
    ->label('End Date')
    ->trim(),
                TextInput::make('days_requested')
    ->numeric()
    ->maxLength(8)
    ->label('Days Requested')
    ->trim(),
                Textarea::make('reason')
    ->columnSpanFull()
    ->label('Reason')
    ->trim(),
                Select::make('approval_status')
    ->default('draft')
    ->label('Status')
    ->options(['draft|pending|manager_review|approved|rejected' => 'Draft|pending|manager Review|approved|rejected'])
    ,
                ])
                ->columnSpanFull(),
        ]);
    }
}