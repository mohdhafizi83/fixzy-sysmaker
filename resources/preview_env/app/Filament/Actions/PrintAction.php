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
                    // Tambah kelas CSS pada body untuk mod cetakan
                    document.body.classList.add('filament-print-mode');

                    // Selepas tetingkap cetakan ditutup, buang kelas CSS
                    window.onafterprint = () => {
                        document.body.classList.remove('filament-print-mode');
                    };

                    // Tunggu sekejap untuk pastikan CSS dimuatkan sebelum mencetak
                    setTimeout(() => {
                        window.print();
                    }, 300);
                JS
            ]);
    }
}