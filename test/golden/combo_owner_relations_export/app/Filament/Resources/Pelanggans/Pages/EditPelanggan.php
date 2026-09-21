<?php

namespace App\Filament\Resources\Pelanggans\Pages;

use App\Filament\Resources\Pelanggans\PelangganResource;
use App\Filament\Actions\PrintAction;
use Filament\Actions\ActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\ReplicateAction;
use Filament\Actions\Action;
use Filament\Resources\Pages\EditRecord;


class EditPelanggan extends EditRecord
{
    protected static string $resource = PelangganResource::class;
    
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
                                $data['emel'] = '';;
                        
                        // Secara pilihan, tambah penanda pada nama untuk menunjukkan ia adalah salinan
                        $data['nama_pelanggan'] = ($data['nama_pelanggan'] ?? '') . ' (Copy)';
                        
                        return $data;
                    })
                    ->visible(! session('is_in_iframe')),
                DeleteAction::make(),
            ]),
        ];
    }
    

    public function mount(string|int $record): void
    {
        parent::mount($record);
        if (request()->has('iframe')) {
            session(['is_in_iframe' => true]);
        } else {
            session()->forget('is_in_iframe');
        }
    }
	
    public function getLayout(): string
    {
        if (request()->has('iframe')) {
            return 'filament.layouts.custom-iframe-layout';
        }
        return parent::getLayout();
    }



    protected function getFormActions(): array
    {
        return [];
    }
}