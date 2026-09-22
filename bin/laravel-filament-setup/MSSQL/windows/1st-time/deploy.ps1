# ============================================================================
# == KONFIGURASI (Ubah mengikut keperluan anda)
# ============================================================================
$GitRepoUrl   = "https://github.com/nama-anda/projek-anda.git"
$GeneratedDir = Join-Path -Path $env:APPDATA -ChildPath "fixzy-sysmaker\generated"
$ProjectDir   = "C:\laragon\www\my-new-project"

# -- KONFIGURASI SQL SERVER --
$SqlServerInstance = "localhost\SQLEXPRESS" # Atau "localhost" jika bukan edisi Express
$SqlAdminUser      = "sa" # Pengguna superuser SQL Server anda
$SqlAdminPass      = "PasswordAdminAnda" # Kata laluan superuser SQL Server
$DbName            = "project_db_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$DbUser            = "project_user"
$DbPass            = "PasswordSelamatAplikasiAnda"

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

# --- Langkah 3: Sediakan .env untuk SQL Server ---
Write-Host "[LANGKAH 3] Menyediakan fail .env untuk SQL Server..." -ForegroundColor Yellow
if (-not (Test-Path -Path ".env")) {
    Copy-Item -Path ".env.example" -Destination ".env"
}

# Tetapkan DB_CONNECTION kepada sqlsrv dan masukkan butiran yang relevan
(Get-Content -Path ".env") -replace '^DB_CONNECTION=.*', 'DB_CONNECTION=sqlsrv' | Set-Content -Path ".env"
(Get-Content -Path ".env") -replace '^DB_HOST=.*', "DB_HOST=$SqlServerInstance" | Set-Content -Path ".env"
(Get-Content -Path ".env") -replace '^DB_PORT=.*', 'DB_PORT=1433' | Set-Content -Path ".env"
(Get-Content -Path ".env") -replace '^DB_DATABASE=.*', "DB_DATABASE=$DbName" | Set-Content -Path ".env"
(Get-Content -Path ".env") -replace '^DB_USERNAME=.*', "DB_USERNAME=$DbUser" | Set-Content -Path ".env"
(Get-Content -Path ".env") -replace '^DB_PASSWORD=.*', "DB_PASSWORD=$DbPass" | Set-Content -Path ".env"

Write-Host "[OK] Fail .env telah dikonfigurasi untuk SQL Server." -ForegroundColor Green


# --- Langkah 4: Cipta Pangkalan Data, Login & Pengguna di SQL Server ---
Write-Host "[LANGKAH 4] Menyediakan pangkalan data, login & pengguna di SQL Server..." -ForegroundColor Yellow

# Sediakan skrip T-SQL untuk dijalankan.
# Skrip ini selamat untuk dijalankan berulang kali.
$tsqlScript = @"
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = N'$DbName')
BEGIN
    CREATE DATABASE [$DbName];
END;
GO

IF NOT EXISTS (SELECT * FROM sys.sql_logins WHERE name = N'$DbUser')
BEGIN
    CREATE LOGIN [$DbUser] WITH PASSWORD = N'$DbPass';
END;
GO

USE [$DbName];
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = N'$DbUser')
BEGIN
    CREATE USER [$DbUser] FOR LOGIN [$DbUser];
    ALTER ROLE db_owner ADD MEMBER [$DbUser];
END;
GO
"@

# Jalankan skrip T-SQL menggunakan sqlcmd
try {
    sqlcmd -S $SqlServerInstance -U $SqlAdminUser -P $SqlAdminPass -Q $tsqlScript
    Write-Host "[OK] Pangkalan data SQL Server sedia untuk digunakan." -ForegroundColor Green
}
catch {
    Write-Host "[RALAT] Gagal menjalankan perintah sqlcmd. Pastikan SQL Server Command Line Utilities telah dipasang." -ForegroundColor Red
    # Lemparkan semula ralat untuk menghentikan skrip utama
    throw $_
}

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