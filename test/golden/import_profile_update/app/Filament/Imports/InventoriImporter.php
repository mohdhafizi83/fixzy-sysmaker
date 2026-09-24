<?php

namespace App\Filament\Imports;

use App\Models\Inventori;

use Filament\Actions\Imports\ImportColumn;
use Filament\Actions\Imports\Importer;
use Filament\Actions\Imports\Models\Import;
use Illuminate\Support\Number;
use Filament\Forms\Components\Checkbox;

class InventoriImporter extends Importer
{
    protected static ?string $model = Inventori::class;

    /**
     * Smart-import profile baked at generation time (Fixzy SysMaker).
     * match_field: column used to locate an existing row.
     * mode: update (match→update, else insert) | skip (match→skip,
     * else insert) | insert (always insert).
     */
    protected static ?array $profile = ['match_field' => "item_name", 'mode' => "update", 'dry_run' => false];

    public static function getColumns(): array
    {
        return [
            ImportColumn::make('id')
                ->label('Id')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Id'),

            ImportColumn::make('item_name')
                ->label('Item Name')
                ->requiredMapping()
                ->ignoreBlankState()
                ->rules(['required', 'max:150'])
                ->examples(['Sample Item Name 1', 'Sample Item Name 2'])
                ->exampleHeader('Item Name'),

            ImportColumn::make('kuantiti')
                ->label('Kuantiti')
                ->numeric()
                ->integer()
                ->ignoreBlankState()
                ->rules(['integer'])
                ->examples(['1', '2'])
                ->exampleHeader('Kuantiti'),

            ImportColumn::make('harga_seunit')
                ->label('Harga Seunit')
                ->numeric()
                ->ignoreBlankState()
                ->rules(['max:10'])
                ->examples(['Sample Harga Seunit 1', 'Sample Harga Seunit 2'])
                ->exampleHeader('Harga Seunit'),
        ];
    }

    public function resolveRecord(): ?Inventori
    {
        $mode = static::$profile['mode'] ?? 'update';

        if ($mode === 'insert') {
            return new Inventori();
        }

        $matchField = static::$profile['match_field'] ?? '';
        $value = $this->data[$matchField] ?? null;

        if ($matchField === '' || $value === null || $value === '') {
            // No usable match value → always insert.
            return new Inventori();
        }

        $existing = Inventori::where($matchField, $value)->first();

        if (! $existing) {
            return new Inventori();
        }

        if ($mode === 'skip') {
            // Match found but profile says skip → return null so the
            // row is not processed further.
            return null;
        }

        // mode === 'update'
        return $existing;
    }

    public function saveRecord(): void
    {
        // Dry-run: validation already ran upstream; skip persistence.
        if (! empty($this->options['dry_run'])) {
            return;
        }

        parent::saveRecord();
    }

    public static function getCompletedNotificationBody(Import $import): string
    {
        $dryRun = ! empty($import->options['dry_run']);
        $verb = $dryRun ? 'validated' : 'imported';
        $body = 'Your Inventori import has completed and ' . Number::format($import->successful_rows) . ' ' . str('row')->plural($import->successful_rows) . ' ' . $verb . '.';

        if ($failedRowsCount = $import->getFailedRowsCount()) {
            $body .= ' ' . Number::format($failedRowsCount) . ' ' . str('row')->plural($failedRowsCount) . ' failed to import.';
        }

        return $body;
    }
    
    public static function getOptionsFormComponents(): array
    {
        return [
            Checkbox::make('dry_run')
                ->label('Dry run (validate only, nothing is saved)')
                ->default(false),
        ];
    }

}
