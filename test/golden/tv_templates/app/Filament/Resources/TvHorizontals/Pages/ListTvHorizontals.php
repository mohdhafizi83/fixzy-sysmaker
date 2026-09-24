<?php

namespace App\Filament\Resources\TvHorizontals\Pages;

use App\Filament\Resources\TvHorizontals\TvHorizontalResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

use Filament\Support\Facades\FilamentView;
use Illuminate\Contracts\View\View;
use Illuminate\Contracts\Support\Htmlable;

class ListTvHorizontals extends ListRecords
{
    protected static string $resource = TvHorizontalResource::class;

    public function getTitle(): string | Htmlable
    {
        return 'Pelajar Fakulti Ekonomi'; 
    }
    
    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
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
    
    
}
