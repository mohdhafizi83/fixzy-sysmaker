<?php

namespace App\Filament\Actions;

use Filament\Actions\Action;

/**
 * Native print action (Fixzy SysMaker generated code).
 *
 * Triggers the browser print dialog with a print-mode CSS class so the
 * generated print stylesheet can hide chrome. No 3rd-party package needed.
 */
class PrintAction extends Action
{
    public static function make(?string $name = 'print'): static
    {
        return parent::make($name)
            ->label('Print')
            ->icon('heroicon-o-printer')
            ->color('gray')
            ->url('#') // No server-side action
            ->extraAttributes([
                'onclick' => <<<JS
                    document.body.classList.add('filament-print-mode');
                    window.onafterprint = () => {
                        document.body.classList.remove('filament-print-mode');
                    };
                    setTimeout(() => {
                        window.print();
                    }, 300);
                JS
            ]);
    }
}
