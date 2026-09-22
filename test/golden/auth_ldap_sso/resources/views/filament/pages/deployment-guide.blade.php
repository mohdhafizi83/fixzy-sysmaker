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
                    Open phpMyAdmin or your database terminal, and create a new database (example: <code>auth_ldap_sso</code>).
                </li>
                <li>
                    <strong>Update the <code>.env</code> file:</strong><br>
                    Open the <code>.env</code> file in your project's root folder and change this section:
                    <pre class="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 border border-gray-300 dark:border-gray-700"><code>DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=auth_ldap_sso
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
                <li>Make sure these PHP extensions are enabled: <code>bcmath, ctype, fileinfo, json, mbstring, openssl, pdo, tokenizer, xml</code>, <strong>ldap</strong>.</li>
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

    
    
    <x-filament::section collapsible collapsed>
        <x-slot name="heading">
            Google Single Sign-On — Setup Checklist
        </x-slot>
        <x-slot name="description">
            This application was designed with Google sign-in enabled. Complete these steps to activate it.
        </x-slot>

        <div class="prose max-w-none dark:prose-invert text-sm">
            <ol class="list-decimal pl-5 space-y-2">
                <li>
                    <strong>Create OAuth credentials:</strong> Go to
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="text-primary-600 underline">Google Cloud Console → Credentials</a>,
                    create an <strong>OAuth 2.0 Client ID</strong> of type <strong>Web application</strong>.
                </li>
                <li>
                    <strong>Authorize the redirect URI:</strong> add your application's callback URL
                    (<code>https://your-domain.com/auth/google/callback</code>) to the <em>Authorized redirect URIs</em> list.
                </li>
                <li>
                    <strong>Enter the keys in the admin panel:</strong> open <strong>System → Auth Settings</strong> and paste the
                    <em>Client ID</em> and <em>Client Secret</em>. They are stored securely in the database — no file editing needed.
                </li>
                <li>
                    <strong>Test:</strong> the "Sign in with Google" button appears on the login page. First-time sign-ins are
                    provisioned automatically; existing users are matched by email.
                </li>
            </ol>
            <p class="text-xs text-gray-500 mt-2">
                Powered by <code>laravel/socialite</code> (official Laravel package). If the button shows a 503 error,
                the credentials have not been saved yet.
            </p>
        </div>
    </x-filament::section>
    

    
    
    <x-filament::section collapsible collapsed>
        <x-slot name="heading">
            LDAP / Active Directory — Setup Checklist
        </x-slot>
        <x-slot name="description">
            This application was designed with directory (LDAP) sign-in enabled.
        </x-slot>

        <div class="prose max-w-none dark:prose-invert text-sm">
            <ol class="list-decimal pl-5 space-y-2">
                <li>
                    <strong>PHP extension:</strong> the server must have the <code>ldap</code> extension installed
                    (e.g. <code>apt install php-ldap</code>, or enable it in cPanel → Select PHP Version).
                </li>
                <li>
                    <strong>Service account:</strong> ask your IT administrator for a read-only bind account
                    (e.g. <code>cn=svc-app,ou=Service,dc=example,dc=com</code>) and the base DN of your directory.
                </li>
                <li>
                    <strong>Enter the settings:</strong> open <strong>System → Auth Settings</strong> and fill in the LDAP
                    hosts, port, base DN, bind credentials, and the username attribute
                    (<code>uid</code> for OpenLDAP, <code>samaccountname</code> for Active Directory).
                </li>
                <li>
                    <strong>Test:</strong> users can now sign in on the normal login form with their directory
                    username and password. Accounts are created locally on first successful sign-in.
                </li>
            </ol>
            <p class="text-xs text-gray-500 mt-2">
                Powered by <code>directorytree/ldaprecord</code> (the standard LDAP library for Laravel).
                Local (database) passwords still work as a fallback.
            </p>
        </div>
    </x-filament::section>
    

    

</x-filament-panels::page>
