<x-filament-panels::page>
    @if(session('fixzy_settings_saved'))
        <div class="rounded-lg bg-green-50 border border-green-200 text-green-800 px-4 py-3 text-sm dark:bg-green-950 dark:text-green-200 dark:border-green-800">
            {{ session('fixzy_settings_saved') }}
        </div>
    @endif

    <form wire:submit="save" class="space-y-6">
        

        
        <x-filament::section heading="Google reCAPTCHA v2">
            <p class="text-sm text-gray-500 mb-4">
                Register your site at
                <a href="https://www.google.com/recaptcha/admin" target="_blank" class="text-primary-600 underline">google.com/recaptcha/admin</a>
                (type: reCAPTCHA v2, "I'm not a robot" Checkbox) and paste the keys below. The login page will not
                accept sign-ins until both keys are saved here.
            </p>
            <div class="grid gap-4 md:grid-cols-2">
                <label class="block">
                    <span class="text-sm font-medium">Site key</span>
                    <input type="text" wire:model="settings.recaptcha_site_key"
                           class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm" />
                </label>
                <label class="block">
                    <span class="text-sm font-medium">Secret key</span>
                    <input type="password" wire:model="settings.recaptcha_secret"
                           class="mt-1 w-full rounded-lg border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm" />
                </label>
            </div>
        </x-filament::section>
        

        

        <div class="flex justify-end">
            <x-filament::button type="submit">Save settings</x-filament::button>
        </div>
    </form>
</x-filament-panels::page>

