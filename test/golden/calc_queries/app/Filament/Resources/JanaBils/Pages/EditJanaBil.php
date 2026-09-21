<?php

namespace App\Filament\Resources\JanaBils\Pages;

use App\Filament\Resources\JanaBils\JanaBilResource;
use App\Filament\Actions\PrintAction;
use Filament\Actions\ActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\ReplicateAction;
use Filament\Actions\Action;
use Filament\Resources\Pages\EditRecord;


class EditJanaBil extends EditRecord
{
    protected static string $resource = JanaBilResource::class;
    
        public int $gridColumns = 2;
    
    protected function getHeaderActions(): array
    {
        $nextRecord = static::getResource()::getModel()::where('id', '>', $this->record->id)->orderBy('id', 'asc')->first();   
        return [

        $this->getCancelFormAction()
        ->visible(! session('is_in_iframe')),
        $this->getSaveFormAction()
            ->formId('form'),
            Action::make('next record')
                ->color('gray')
                ->icon('heroicon-o-chevron-double-right')
                ->iconPosition('after')
                ->url(fn (): string => $nextRecord ? static::getResource()::getUrl('edit', ['record' => $nextRecord]) : '#')
                ->visible(! session('is_in_iframe'))
                ->hidden(!$nextRecord),
            ActionGroup::make([
                PrintAction::make()->label('Print')
                ->visible(! session('is_in_iframe')),
                ReplicateAction::make()
                    ->label('Save As Copy')
                    ->mutateRecordDataUsing(function (array $data): array {
                        // Kosongkan medan unik untuk mengelakkan ralat pangkalan data
                        ;
                        
                        // Secara pilihan, tambah penanda pada nama untuk menunjukkan ia adalah salinan
                        $data[''] = ($data[''] ?? '') . ' (Copy)';
                        
                        return $data;
                    })
                    ->visible(! session('is_in_iframe')),
                DeleteAction::make(),
            ]),
        ];
    }
    




    protected function getFormActions(): array
    {
        return [];
    }
}