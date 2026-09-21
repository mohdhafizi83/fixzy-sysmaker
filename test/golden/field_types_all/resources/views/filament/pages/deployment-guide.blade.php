<x-filament-panels::page>
    
    {{-- STATUS DATABASE SEMASA --}}
    <x-filament::section>
        <x-slot name="heading">
            Status Pangkalan Data Semasa
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
                        Anda sedang menggunakan <strong>SQLite</strong>. Ini sesuai untuk pembangunan dan demo, tetapi 
                        <strong>TIDAK DISYORKAN</strong> untuk penggunaan sebenar (Production) yang mempunyai trafik tinggi.
                    @else
                        Syabas! Anda menggunakan pangkalan data gred produksi.
                    @endif
                </p>
            </div>
        </div>
    </x-filament::section>

    {{-- PANDUAN MIGRASI KE MYSQL --}}
    @if($isSqlite)
    <x-filament::section collapsible collapsed>
        <x-slot name="heading">
            Cara Tukar ke MySQL / MariaDB (Production)
        </x-slot>
        <x-slot name="description">
            Ikuti langkah ini apabila anda bersedia untuk melancarkan aplikasi ini di pelayan sebenar.
        </x-slot>

        <div class="prose max-w-none dark:prose-invert text-sm">
            <ol class="list-decimal pl-5 space-y-2">
                <li>
                    <strong>Sediakan Database Kosong:</strong><br>
                    Buka phpMyAdmin atau terminal database anda, dan cipta database baru (contoh: <code>field_types_all</code>).
                </li>
                <li>
                    <strong>Kemaskini fail <code>.env</code>:</strong><br>
                    Buka fail <code>.env</code> di folder utama projek anda dan ubah bahagian ini:
                    <pre class="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 border border-gray-300 dark:border-gray-700"><code>DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=field_types_all
DB_USERNAME=root
DB_PASSWORD=kata_laluan_anda</code></pre>
                </li>
                <li>
                    <strong>Jalankan Migrasi:</strong><br>
                    Buka terminal di folder projek dan jalankan arahan berikut untuk membina struktur jadual:
                    <pre class="bg-black text-green-400 p-2 rounded mt-1"><code>php artisan migrate --force</code></pre>
                </li>
                <li>
                    <strong>Masukkan Data Awal (Seeding):</strong><br>
                    Untuk memasukkan pengguna admin dan data asas:
                    <pre class="bg-black text-green-400 p-2 rounded mt-1"><code>php artisan db:seed</code></pre>
                </li>
            </ol>
        </div>
    </x-filament::section>
    @endif

    {{-- PANDUAN DEPLOYMENT UMUM --}}
    <x-filament::section collapsible collapsed>
        <x-slot name="heading">
            Panduan Upload ke cPanel / Shared Hosting
        </x-slot>

        <div class="prose max-w-none dark:prose-invert text-sm">
            <ul class="list-disc pl-5 space-y-2">
                <li>Pastikan server anda menyokong <strong>PHP 8.1</strong> atau ke atas.</li>
                <li>Pastikan sambungan PHP (Extensions) ini diaktifkan: <code>bcmath, ctype, fileinfo, json, mbstring, openssl, pdo, tokenizer, xml</code>.</li>
                <li>
                    Struktur folder yang disyorkan:
                    <ul class="list-circle pl-5 mt-1">
                        <li>Letakkan kandungan folder <code>public</code> ke dalam <code>public_html</code>.</li>
                        <li>Letakkan fail projek selebihnya di luar <code>public_html</code> (contoh: folder <code>project_core</code>) untuk keselamatan.</li>
                        <li>Kemaskini fail <code>index.php</code> di <code>public_html</code> untuk menghalakan path ke folder <code>project_core</code>.</li>
                    </ul>
                </li>
                <li>
                    Jangan lupa setkan <code>APP_ENV=production</code> dan <code>APP_DEBUG=false</code> di dalam fail <code>.env</code> pelayan anda.
                </li>
            </ul>
        </div>
    </x-filament::section>

</x-filament-panels::page>