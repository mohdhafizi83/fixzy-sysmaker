# ============================================================================
# == KONFIGURASI (Ubah mengikut keperluan anda)
# ============================================================================
$GitRepoUrl   = "https://github.com/nama-anda/projek-anda.git"
$GeneratedDir = Join-Path -Path $env:APPDATA -ChildPath "fizisysmaker\generated"
$ProjectDir   = "C:\laragon\www\my-new-project"

# Menjana nama DB unik menggunakan format YYYYMMDD_HHMMSS
$Timestamp    = Get-Date -Format "yyyyMMdd_HHmmss"
$DbName       = "project_db_$Timestamp"
$DbUser       = "project_user"
$DbPass       = "PasswordSelamatAnda"
$DbRootPass   = "root_password"

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

    # --- Langkah 3: Sediakan & Konfigurasi .env secara automatik ---
    Write-Host "[LANGKAH 3] Menyediakan fail .env..." -ForegroundColor Yellow
    if (-not (Test-Path -Path ".env")) {
        Copy-Item -Path ".env.example" -Destination ".env"
    }

    # Guna kaedah natif PowerShell untuk menggantikan kandungan fail
    (Get-Content -Path ".env") -replace '^APP_URL=.*', 'APP_URL=http://localhost' | Set-Content -Path ".env"
	(Get-Content -Path ".env") -replace '^DB_CONNECTION=.*', 'DB_CONNECTION=mysql' | Set-Content -Path ".env"
    (Get-Content -Path ".env") -replace '^DB_DATABASE=.*', "DB_DATABASE=$DbName" | Set-Content -Path ".env"
    (Get-Content -Path ".env") -replace '^DB_USERNAME=.*', "DB_USERNAME=$DbUser" | Set-Content -Path ".env"
    (Get-Content -Path ".env") -replace '^DB_PASSWORD=.*', "DB_PASSWORD=$DbPass" | Set-Content -Path ".env"
    Write-Host "[OK] Fail .env telah dikonfigurasi." -ForegroundColor Green

    # --- Langkah 4: Sediakan Pangkalan Data (MySQL) ---
    Write-Host "[LANGKAH 4] Menyediakan pangkalan data di server..." -ForegroundColor Yellow
    mysql -u root -p"$DbRootPass" -e "CREATE DATABASE IF NOT EXISTS $DbName;"
    mysql -u root -p"$DbRootPass" -e "CREATE USER IF NOT EXISTS '$DbUser'@'localhost' IDENTIFIED BY '$DbPass';"
    mysql -u root -p"$DbRootPass" -e "GRANT ALL PRIVILEGES ON $DbName.* TO '$DbUser'@'localhost';"
    mysql -u root -p"$DbRootPass" -e "FLUSH PRIVILEGES;"
    Write-Host "[OK] Pangkalan data '$DbName' sedia untuk digunakan." -ForegroundColor Green

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