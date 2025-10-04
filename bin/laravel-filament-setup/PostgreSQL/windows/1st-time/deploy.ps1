# ============================================================================
# == KONFIGURASI (Ubah mengikut keperluan anda)
# ============================================================================
$GitRepoUrl   = "https://github.com/nama-anda/projek-anda.git"
$GeneratedDir = Join-Path -Path $env:APPDATA -ChildPath "fizisysmaker\generated"
$ProjectDir   = "C:\laragon\www\my-new-project"

# -- KONFIGURASI POSTGRESQL --
$PgAdminUser = "postgres" # Pengguna superuser PostgreSQL anda
$PgAdminPass = "root_password" # Kata laluan superuser PostgreSQL
$DbName      = "project_db_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$DbUser      = "project_user"
$DbPass      = "PasswordSelamatAnda"

# ============================================================================
# == MULA PROSES AUTOMASI
# ============================================================================

# Hentikan skrip serta-merta jika sebarang perintah gagal
$ErrorActionPreference = "Stop"

# Blok utama dengan pengurusan ralat
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
    Write-Host "[LANGKAH 2] Menyalin fail dari direktori janaan..." -ForegroundColor Yellow
    if (-not (Test-Path -Path $ProjectDir)) {
        New-Item -ItemType Directory -Path $ProjectDir | Out-Null
    }
    Robocopy $GeneratedDir $ProjectDir /E /PURGE /NFL /NDL /NJH /NJS /nc /ns /np
    Write-Host "[OK] Fail berjaya disalin." -ForegroundColor Green
    
    # Tukar lokasi ke direktori projek
    Set-Location -Path $ProjectDir

# --- Langkah 3: Sediakan .env untuk PostgreSQL ---
Write-Host "[LANGKAH 3] Menyediakan fail .env untuk PostgreSQL..." -ForegroundColor Yellow
if (-not (Test-Path -Path ".env")) {
    Copy-Item -Path ".env.example" -Destination ".env"
}

# Tetapkan DB_CONNECTION kepada pgsql dan masukkan butiran yang relevan
(Get-Content -Path ".env") -replace '^DB_CONNECTION=.*', 'DB_CONNECTION=pgsql' | Set-Content -Path ".env"
(Get-Content -Path ".env") -replace '^DB_HOST=.*', 'DB_HOST=127.0.0.1' | Set-Content -Path ".env"
(Get-Content -Path ".env") -replace '^DB_PORT=.*', 'DB_PORT=5432' | Set-Content -Path ".env"
(Get-Content -Path ".env") -replace '^DB_DATABASE=.*', "DB_DATABASE=$DbName" | Set-Content -Path ".env"
(Get-Content -Path ".env") -replace '^DB_USERNAME=.*', "DB_USERNAME=$DbUser" | Set-Content -Path ".env"
(Get-Content -Path ".env") -replace '^DB_PASSWORD=.*', "DB_PASSWORD=$DbPass" | Set-Content -Path ".env"

Write-Host "[OK] Fail .env telah dikonfigurasi untuk PostgreSQL." -ForegroundColor Green


# --- Langkah 4: Cipta Pangkalan Data & Pengguna di PostgreSQL ---
Write-Host "[LANGKAH 4] Menyediakan pangkalan data & pengguna di PostgreSQL..." -ForegroundColor Yellow

# Tetapkan kata laluan untuk sambungan psql secara sementara
$env:PGPASSWORD = $PgAdminPass

# Periksa jika pengguna sudah wujud, jika tidak, cipta
$userExists = psql -U $PgAdminUser -h localhost -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'"
if (-not $userExists) {
    psql -U $PgAdminUser -h localhost -c "CREATE USER $DbUser WITH PASSWORD '$DbPass';"
    Write-Host "[INFO] Pengguna '$DbUser' telah dicipta." -ForegroundColor Gray
} else {
    Write-Host "[INFO] Pengguna '$DbUser' sudah wujud." -ForegroundColor Gray
}

# Periksa jika pangkalan data sudah wujud, jika tidak, cipta
$dbExists = psql -U $PgAdminUser -h localhost -lqt | findstr "\b$DbName\b"
if (-not $dbExists) {
    psql -U $PgAdminUser -h localhost -c "CREATE DATABASE $DbName OWNER $DbUser;"
    Write-Host "[INFO] Pangkalan data '$DbName' telah dicipta." -ForegroundColor Gray
} else {
    Write-Host "[INFO] Pangkalan data '$DbName' sudah wujud." -ForegroundColor Gray
}

# Berikan semua kebenaran kepada pengguna
# psql -U $PgAdminUser -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser;"

# Kosongkan kata laluan dari environment variable
Remove-Item env:PGPASSWORD

Write-Host "[OK] Pangkalan data PostgreSQL sedia untuk digunakan." -ForegroundColor Green


    # --- Langkah 5: Pasang Kebergantungan & Sediakan Laravel ---
    Write-Host "[LANGKAH 5] Memasang kebergantungan Composer & menyediakan aplikasi..." -ForegroundColor Yellow
    composer install --optimize-autoloader
    php artisan key:generate

    # --- Langkah 6: Migrasi & Penyediaan Shield ---
    Write-Host "[LANGKAH 6] Menjalankan migrasi & menjana kebenaran Shield..." -ForegroundColor Yellow
    php artisan migrate --force
    php artisan shield:generate --all --panel=admin --no-interaction
    php artisan db:seed

    # --- Langkah 7: Bina Aset Frontend ---
    Write-Host "[LANGKAH 7] Membina aset frontend..." -ForegroundColor Yellow
    npm install
    npm run build

    # --- Langkah 8: Optimumkan untuk Produksi ---
    Write-Host "[LANGKAH 8] Mengoptimumkan cache untuk produksi..." -ForegroundColor Yellow
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    php artisan storage:link
    
    Write-Host ""
    Write-Host "=================================================" -ForegroundColor Green
    Write-Host "     PEMASANGAN AUTOMATIK SELESAI!     " -ForegroundColor Green
    Write-Host "=================================================" -ForegroundColor Green
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