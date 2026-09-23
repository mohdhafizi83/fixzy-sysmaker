<x-filament-panels::page>
    @if(session('fixzy_settings_saved'))
        <div class="rounded-lg bg-green-50 border border-green-200 text-green-800 px-4 py-3 text-sm dark:bg-green-950 dark:text-green-200 dark:border-green-800">
            {{ session('fixzy_settings_saved') }}
        </div>
    @endif
    @if(session('fixzy_settings_error'))
        <div class="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm dark:bg-red-950 dark:text-red-200 dark:border-red-800">
            {{ session('fixzy_settings_error') }}
        </div>
    @endif

    <x-filament::section heading="Connection Status">
        @if($this->credentialsConfigured)
            <p class="text-sm text-green-700 dark:text-green-300">
                ✓ Service account credentials are configured.
            </p>
        @else
            <p class="text-sm text-amber-700 dark:text-amber-300">
                ⚠ No service account configured yet. Paste the JSON key below to enable sync.
            </p>
        @endif
    </x-filament::section>

    <form wire:submit="save" class="space-y-6">
        <x-filament::section heading="Service Account">
            <p class="text-sm text-gray-500 mb-4">
                Create a service account in your
                <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" class="text-primary-600 underline">Google Cloud console</a>,
                enable the <strong>Google Sheets API</strong> and <strong>Google Drive API</strong>, then download the JSON key
                and paste the full contents here. It is stored privately on the server (storage/app/private), never in code.
            </p>
            <label class="block">
                <span class="text-sm font-medium">Service account JSON key</span>
                <textarea wire:model="uploadJson" rows="6" placeholder='{"type": "service_account", ...}'
                        class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-xs font-mono"></textarea>
            </label>
            <p class="text-xs text-gray-400 mt-2">
                Leave empty to keep the current key. Pasting a new key replaces it.
            </p>
        </x-filament::section>

        <x-filament::section heading="Sync Options">
            <div class="grid gap-4 md:grid-cols-2">
                <label class="block">
                    <span class="text-sm font-medium">Auto-share sheets with (email)</span>
                    <input type="email" wire:model="settings.gsheets_share_email" placeholder="admin@example.com"
                           class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm" />
                    <p class="text-xs text-gray-400 mt-1">Newly created spreadsheets are shared with this address as editor.</p>
                </label>
                <label class="block">
                    <span class="text-sm font-medium">Poll interval (minutes)</span>
                    <input type="number" min="1" max="60" wire:model="settings.gsheets_poll_minutes"
                           class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm" />
                    <p class="text-xs text-gray-400 mt-1">How often changes in the sheets are pulled into the database. Requires the Laravel scheduler (<code>schedule:run</code> cron).</p>
                </label>
            </div>
        </x-filament::section>

        <div class="flex justify-end gap-3">
            <x-filament::button type="submit">Save settings</x-filament::button>
        </div>
    </form>
</x-filament-panels::page>

