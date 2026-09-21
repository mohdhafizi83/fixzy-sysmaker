<?php

namespace App\Filament\Resources\Invoices\Pages;

use App\Filament\Resources\Invoices\InvoiceResource;
use App\Filament\Actions\PrintAction;
use Filament\Actions\ActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\ReplicateAction;
use Filament\Actions\Action;
use Filament\Resources\Pages\EditRecord;
use Filament\Support\Facades\FilamentView;
use Illuminate\Contracts\View\View;

class EditInvoice extends EditRecord
{
    protected static string $resource = InvoiceResource::class;
    
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
                        $data['fakulti_id'] = ($data['fakulti_id'] ?? '') . ' (Copy)';
                        
                        return $data;
                    })
                    ->visible(! session('is_in_iframe')),
                DeleteAction::make(),
            ]),
        ];
    }
    


    public function render(): View
    {
        FilamentView::registerRenderHook(
            'panels::body.end',
            fn (): string => <<<HTML
                <script>
                    document.addEventListener('click', function (event) {
                        if (event.target.closest('.fi-modal-close-btn')) {
                            setTimeout(() => {
                                window.parent.location.reload();
                            }, 100);
                        }
                    });
                </script>
            HTML
        );
        return parent::render();
    }


    protected function getFormActions(): array
    {
        return [];
    }
}