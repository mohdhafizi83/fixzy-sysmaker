<?php

namespace App\Filament\Resources\ItemTempahans\Pages;

use App\Filament\Resources\ItemTempahans\ItemTempahanResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Database\Eloquent\Builder;
use Filament\Support\Facades\FilamentView;
use Illuminate\Contracts\View\View;
use Illuminate\Contracts\Support\Htmlable;

class ListItemTempahans extends ListRecords
{
    protected static string $resource = ItemTempahanResource::class;

    public function getTitle(): string | Htmlable
    {
        return 'Pelajar Fakulti Ekonomi'; 
    }
    
    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()
    ->when(
        session('is_in_iframe'),
        fn (CreateAction $action) => $action->url(fn (): string => static::getResource()::getUrl('create', [
                    'tempahan_id' => request()->query('tempahan_id')
                ]))
    )
        ];
    }
    
    
    protected function getTableQuery(): Builder
    {
        $query = parent::getTableQuery();
        
        if ($fkValue = request()->query('tempahan_id')) {
            $query->where('tempahan_id', $fkValue);
        }
        return $query;
    }
    
    public function render(): View
    {
        

        
        if ((bool) request()->query('print')) {
            FilamentView::registerRenderHook(
                'panels::body.end',
                fn (): string => <<<HTML
                    <style>
                        @media print {
                            body { visibility: hidden; }
                            .fi-ta-content-ctn, .fi-ta-content-ctn * { visibility: visible; }
                            .fi-ta-content-ctn { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; }
                            body { font-size: 12pt !important; background-color: #fff !important; }
                            .fi-ta-cell .fi-ta-actions { display: none !important; }
                        }
                    </style>
                    <script>
                        window.onload = () => {
                            window.print();
                            window.onafterprint = () => { window.close(); };
                        };
                    </script>
                HTML
            );
        }

        return parent::render();
    }
    
    
    public function mount(): void
    {
        parent::mount();

        if (request()->has('iframe')) {
            session(['is_in_iframe' => true]);
            session(['foreignkey' => 'tempahan_id']);
        } else {
            session()->forget('is_in_iframe');
            session()->forget('foreignkey');
        }
    }
    
    public function getLayout(): string
    {
        if (session('is_in_iframe')) {
            return 'filament.layouts.custom-iframe-layout';
        }
        return parent::getLayout();
    }
}
