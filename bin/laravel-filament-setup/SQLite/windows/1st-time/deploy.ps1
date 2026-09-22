# ============================================================================
# == KONFIGURASI (Ubah mengikut keperluan anda)
# ============================================================================
$GitRepoUrl   = "https://github.com/nama-anda/projek-anda.git"
$GeneratedDir = Join-Path -Path $env:APPDATA -ChildPath "fixzy-sysmaker\generated"
$ProjectDir   = "C:\laragon\www\my-new-project"

# ============================================================================
# == MULA PROSES AUTOMASI
# ============================================================================
# Hentikan skrip serta-merta jika sebarang perintah gagal
$ErrorActionPreference = "Stop"

try {
    Write-Host ""
    Write-Host "🚀 Memulakan proses pemasangan automatik..." -ForegroundColor Cyan
    Write-Host "================================================="

    # --- LANGKAH 1: Muat turun templat asas dari Git ---
    Write-Host "[LANGKAH 1] Memuat turun templat asas dari repositori Git..." -ForegroundColor Yellow
    if (Test-Path -Path $ProjectDir) {
        Remove-Item -Path $ProjectDir -Recurse -Force
    }
    git clone $GitRepoUrl $ProjectDir
    Write-Host "[OK] Repositori berjaya di-clone." -ForegroundColor Green
    
    # --- Langkah 2: Salin fail dari aplikasi low-code ---
    Write-Host "[LANGKAH 2] Menyalin fail spesifik dari direktori janaan..." -ForegroundColor Yellow
    Robocopy $GeneratedDir $ProjectDir /E /PURGE /NFL /NDL /NJH /NJS /nc /ns /np
    Write-Host "[OK] Fail spesifik berjaya disalin." -ForegroundColor Green
    
    Set-Location -Path $ProjectDir

    # --- Langkah 3: Sediakan .env & Pangkalan Data SQLite ---
    Write-Host "[LANGKAH 3] Menyediakan fail .env untuk SQLite..." -ForegroundColor Yellow
    if (-not (Test-Path -Path ".env")) {
        Copy-Item -Path ".env.example" -Destination ".env"
    }

    (Get-Content -Path ".env") -replace '^DB_CONNECTION=.*', 'DB_CONNECTION=sqlite' | Set-Content -Path ".env"
    (Get-Content -Path ".env") -replace '^DB_HOST=.*', 'DB_HOST=' | Set-Content -Path ".env"
    (Get-Content -Path ".env") -replace '^DB_PORT=.*', 'DB_PORT=' | Set-Content -Path ".env"
    (Get-Content -Path ".env") -replace '^DB_DATABASE=.*', 'DB_DATABASE=' | Set-Content -Path ".env"
    (Get-Content -Path ".env") -replace '^DB_USERNAME=.*', 'DB_USERNAME=' | Set-Content -Path ".env"
    (Get-Content -Path ".env") -replace '^DB_PASSWORD=.*', 'DB_PASSWORD=' | Set-Content -Path ".env"
    Write-Host "[OK] Fail .env telah dikonfigurasi untuk SQLite." -ForegroundColor Green

    # --- Langkah 4: Cipta Fail Pangkalan Data SQLite ---
    Write-Host "[LANGKAH 4] Menyediakan fail pangkalan data SQLite..." -ForegroundColor Yellow
    $sqlitePath = Join-Path -Path $ProjectDir -ChildPath "database\database.sqlite"

    if (-not (Test-Path -Path $sqlitePath)) {
        New-Item -Path $sqlitePath -ItemType File | Out-Null
        Write-Host "[OK] Fail 'database.sqlite' telah dicipta." -ForegroundColor Green
    } else {
        Write-Host "[INFO] Fail 'database.sqlite' sudah wujud." -ForegroundColor Gray
    }

    # --- Langkah 5 s/d 8 dikekalkan seperti biasa ---
    # (Langkah 5: Composer, Langkah 6: Migrasi, Langkah 7: Frontend, Langkah 8: Cache)
    # ... (kod yang sama seperti sebelum ini) ...

    # --- LANGKAH 5: Pasang Kebergantungan & Sediakan Laravel ---
    Write-Host "[LANGKAH 5] Memasang kebergantungan Composer & menyediakan aplikasi..." -ForegroundColor Yellow
    composer install --no-dev --optimize-autoloader
    php artisan key:generate

    # --- LANGKAH 6: Migrasi & Penyediaan Shield ---
    Write-Host "[LANGKAH 6] Menjalankan migrasi & menjana kebenaran Shield..." -ForegroundColor Yellow
    php artisan migrate --force
    php artisan shield:generate --all --panel=admin --no-interaction
    php artisan db:seed --class=ProductionSeeder --force

    # --- LANGKAH 7: Bina Aset Frontend ---
    Write-Host "[LANGKAH 7] Membina aset frontend..." -ForegroundColor Yellow
    npm install
    npm run build

    # --- LANGKAH 8: Optimumkan untuk Produksi ---
    Write-Host "[LANGKAH 8] Mengoptimumkan cache untuk produksi..." -ForegroundColor Yellow
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    php artisan storage:link

    Write-Host ""
    Write-Host "=================================================" -ForegroundColor Green
    Write-Host "     PEMASANGAN AUTOMATIK SELESAI!     " -ForegroundColor Green
    Write--Host "=================================================" -ForegroundColor Green
    Write-Host ""

}
catch {
    # Bahagian ini akan berjalan jika sebarang ralat berlaku
    Write-Host ""
    Write-Host "=================================================" -ForegroundColor Red
    Write-Host "          RALAT BERLAKU SEMASA PROSES            " -ForegroundColor Red
    Write-Host "=================================================" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    exit 1
}