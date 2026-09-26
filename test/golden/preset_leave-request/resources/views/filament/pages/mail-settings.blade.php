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

    <form wire:submit="save" class="space-y-6">
        <x-filament::section heading="SMTP Server">
            <p class="text-sm text-gray-500 mb-4">
                Configure the outgoing mail server used by workflow <strong>Send Email</strong> actions.
                These values override <code>.env</code> at runtime and are stored in the database —
                never committed to code. Leave empty to fall back to the <code>.env</code> mail configuration.
            </p>
            <div class="grid gap-4 md:grid-cols-2">
                <label class="block">
                    <span class="text-sm font-medium">SMTP host</span>
                    <input type="text" wire:model="settings.mail_host" placeholder="smtp.example.com"
                           class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm" />
                </label>
                <label class="block">
                    <span class="text-sm font-medium">Port</span>
                    <input type="text" wire:model="settings.mail_port" placeholder="587"
                           class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm" />
                </label>
                <label class="block">
                    <span class="text-sm font-medium">Username</span>
                    <input type="text" wire:model="settings.mail_username" placeholder="smtp-user@example.com"
                           class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm" />
                </label>
                <label class="block">
                    <span class="text-sm font-medium">Password</span>
                    <input type="password" wire:model="settings.mail_password"
                           class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm" />
                </label>
                <label class="block">
                    <span class="text-sm font-medium">Encryption</span>
                    <select wire:model="settings.mail_encryption"
                          class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm">
                        <option value="tls">TLS (port 587)</option>
                        <option value="ssl">SSL (port 465)</option>
                        <option value="">None</option>
                    </select>
                </label>
            </div>
        </x-filament::section>

        <x-filament::section heading="From Address">
            <div class="grid gap-4 md:grid-cols-2">
                <label class="block">
                    <span class="text-sm font-medium">From email address</span>
                    <input type="email" wire:model="settings.mail_from_address" placeholder="app@example.com"
                           class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm" />
                </label>
                <label class="block">
                    <span class="text-sm font-medium">From name</span>
                    <input type="text" wire:model="settings.mail_from_name" placeholder="{{ config('app.name') }}"
                           class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm" />
                </label>
            </div>
        </x-filament::section>

        <div class="flex justify-end gap-3">
            <x-filament::button type="submit">Save settings</x-filament::button>
            <x-filament::button type="button" color="gray" wire:click="testSend">Send test email</x-filament::button>
        </div>
    </form>
</x-filament-panels::page>

