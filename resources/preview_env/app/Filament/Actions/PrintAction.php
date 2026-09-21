<?php

namespace App\Filament\Actions;

use Filament\Actions\Action;

class PrintAction extends Action
{
    public static function make(?string $name = 'print'): static
    {
        return parent::make($name)
            ->label('Cetak')
            ->icon('heroicon-o-printer')
            ->color('gray')
            ->url('#') // Halang tindakan server-side
            ->extraAttributes([
                'onclick' => <<<JS
                    // Add a CSS class to the body for print mode
                    document.body.classList.add('filament-print-mode');

                    // After the print window closes, remove the CSS class
                    window.onafterprint = () => {
                        document.body.classList.remove('filament-print-mode');
                    };

                    // Brief pause to ensure CSS is loaded before printing
                    setTimeout(() => {
                        window.print();
                    }, 300);
                JS
            ]);
    }
}