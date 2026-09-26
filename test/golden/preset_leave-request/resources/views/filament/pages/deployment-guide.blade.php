<x-filament-panels::page>
    
    {{-- CURRENT DATABASE STATUS --}}
    <x-filament::section>
        <x-slot name="heading">
            Current Database Status
        </x-slot>

        <div class="flex items-center gap-4">
            <div class="p-4 rounded-lg @if($isSqlite) bg-yellow-50 text-yellow-700 border border-yellow-200 @else bg-green-50 text-green-700 border border-green-200 @endif">
                <div class="flex items-center gap-2">
                    <x-filament::icon
                        :icon="$isSqlite ? 'heroicon-m-exclamation-triangle' : 'heroicon-m-check-circle'"
                        class="h-6 w-6"
                    />
                    <span class="text-lg font-bold uppercase">{{ $currentConnection }}</span>
                </div>
                <p class="mt-2 text-sm">
                    @if($isSqlite)
                        You are currently using <strong>SQLite</strong>. This is suitable for development and demos, but 
                        <strong>NOT RECOMMENDED</strong> for real-world (production) use with high traffic.
                    @else
                        Well done! You are using a production-grade database.
                    @endif
                </p>
            </div>
        </div>
    </x-filament::section>

    {{-- MIGRATION GUIDE TO MYSQL --}}
    @if($isSqlite)
    <x-filament::section collapsible collapsed>
        <x-slot name="heading">
            How to Switch to MySQL / MariaDB (Production)
        </x-slot>
        <x-slot name="description">
            Follow these steps when you are ready to launch this application on a real server.
        </x-slot>

        <div class="prose max-w-none dark:prose-invert text-sm">
            <ol class="list-decimal pl-5 space-y-2">
                <li>
                    <strong>Prepare an Empty Database:</strong><br>
                    Open phpMyAdmin or your database terminal, and create a new database (example: <code>leave_request_pack</code>).
                </li>
                <li>
                    <strong>Update the <code>.env</code> file:</strong><br>
                    Open the <code>.env</code> file in your project's root folder and change this section:
                    <pre class="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 border border-gray-300 dark:border-gray-700"><code>DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=leave_request_pack
DB_USERNAME=root
DB_PASSWORD=your_password</code></pre>
                </li>
                <li>
                    <strong>Run Migrations:</strong><br>
                    Open a terminal in the project folder and run the following command to build the table structure:
                    <pre class="bg-black text-green-400 p-2 rounded mt-1"><code>php artisan migrate --force</code></pre>
                </li>
                <li>
                    <strong>Insert Initial Data (Seeding):</strong><br>
                    To insert the admin user and base data:
                    <pre class="bg-black text-green-400 p-2 rounded mt-1"><code>php artisan db:seed</code></pre>
                </li>
            </ol>
        </div>
    </x-filament::section>
    @endif

    {{-- GENERAL DEPLOYMENT GUIDE --}}
    <x-filament::section collapsible collapsed>
        <x-slot name="heading">
            Uploading to cPanel / Shared Hosting Guide
        </x-slot>

        <div class="prose max-w-none dark:prose-invert text-sm">
            <ul class="list-disc pl-5 space-y-2">
                <li>Make sure your server supports <strong>PHP 8.1</strong> or above.</li>
                <li>Make sure these PHP extensions are enabled: <code>bcmath, ctype, fileinfo, json, mbstring, openssl, pdo, tokenizer, xml</code>.</li>
                <li>
                    Recommended folder structure:
                    <ul class="list-circle pl-5 mt-1">
                        <li>Place the contents of the <code>public</code> folder into <code>public_html</code>.</li>
                        <li>Place the rest of the project files outside <code>public_html</code> (example: a <code>project_core</code> folder) for security.</li>
                        <li>Update the <code>index.php</code> file in <code>public_html</code> to point the path to the <code>project_core</code> folder.</li>
                    </ul>
                </li>
                <li>
                    Don't forget to set <code>APP_ENV=production</code> and <code>APP_DEBUG=false</code> in the <code>.env</code> file on your server.
                    
                </li>
            </ul>
        </div>
    </x-filament::section>

    

    

    

</x-filament-panels::page>
