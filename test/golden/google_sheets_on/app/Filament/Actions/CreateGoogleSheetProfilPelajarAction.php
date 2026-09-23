<?php

namespace App\Filament\Actions;

use App\Models\GoogleSheetSync;
use App\Services\GoogleSheets\GoogleSheetsSyncService;
use Filament\Actions\Action;
use Filament\Support\Icons\Heroicon;

/**
 * "Create Google Sheet" header action for synced listings
 * (Fixzy SysMaker generated, one per synced table).
 *
 * Creates the spreadsheet, pushes all current rows, shares it with the
 * configured admin email, and opens the sheet link. If a sheet already
 * exists, the action becomes "Open Google Sheet" + "Re-sync Now".
 */
class CreateGoogleSheetProfilPelajarAction
{
    protected const TABLE_KEY = 'ProfilPelajar';

    public static function make(): Action
    {
        $existing = GoogleSheetSync::where('table_key', self::TABLE_KEY)->first();

        if ($existing && $existing->spreadsheet_id) {
            $action = Action::make('openGoogleSheet')
                ->label('Open Google Sheet')
                ->icon(Heroicon::OutlinedDocumentChartBar)
                ->color('success')
                ->url($existing->sheetUrl(), shouldOpenInNewTab: true);
        } else {
            $action = Action::make('createGoogleSheet')
                ->label('Create Google Sheet')
                ->icon(Heroicon::OutlinedDocumentChartBar)
                ->color('info')
                ->requiresConfirmation()
                ->modalHeading('Create Google Sheet')
                ->modalDescription('This creates a Google Spreadsheet containing all current records. Changes in the sheet are synced back to the database every few minutes. Rows deleted in the sheet are ignored.')
                ->action(function (): void {
                    if (! GoogleSheetsSyncService::credentialsConfigured()) {
                        \Filament\Support\Facades\FilamentToast::error(
                            'Google credentials missing',
                            'Configure the service account in System → Google Sheets first.'
                        );
                        return;
                    }
                    try {
                        $mapping = app(GoogleSheetsSyncService::class)->createSheetFor(self::TABLE_KEY);
                        \Filament\Support\Facades\FilamentToast::success(
                            'Google Sheet created',
                            $mapping->sheetUrl()
                        );
                    } catch (\Throwable $e) {
                        \Filament\Support\Facades\FilamentToast::error('Sheet creation failed', $e->getMessage());
                    }
                });
        }

        return $action;
    }
}
