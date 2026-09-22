#!/bin/bash

# Hentikan skrip jika berlaku sebarang ralat
set -e

# --- KONFIGURASI (Ubah mengikut keperluan) ---
GIT_REPO_URL="https://github.com/nama-anda/projek-anda.git"
# Gunakan laluan yang sesuai untuk persekitaran Bash/Linux
GENERATED_DIR="/path/to/fixzy-sysmaker/generated" 
PROJECT_DIR="/var/www/my-new-project"

# --- MULA PROSES AUTOMASI ---

echo "🚀 Memulakan proses pemasangan automatik..."

# LANGKAH 1: Muat turun templat asas dari Git
echo "1. Memuat turun templat asas dari repositori Git..."
if [ -d "$PROJECT_DIR" ]; then
    rm -rf "$PROJECT_DIR"
fi
git clone "$GIT_REPO_URL" "$PROJECT_DIR"

# LANGKAH 2: Salin fail dari aplikasi low-code (WAJIB)
echo "2. Menyalin fail spesifik dari direktori janaan..."
rsync -av --delete "$GENERATED_DIR/" "$PROJECT_DIR/"

cd "$PROJECT_DIR"

# Langkah 3: Sediakan & Konfigurasi .env untuk SQLite
echo "3. Menyediakan fail .env untuk SQLite..."
if [ ! -f ".env" ]; then
    cp .env.example .env
fi

sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=sqlite/' .env
sed -i '/^DB_HOST=.*/d' .env
sed -i '/^DB_PORT=.*/d' .env
sed -i '/^DB_DATABASE=.*/d' .env
sed -i '/^DB_USERNAME=.*/d' .env
sed -i '/^DB_PASSWORD=.*/d' .env
echo "   -> Fail .env telah dikonfigurasi."

# Langkah 4: Sediakan Fail Pangkalan Data SQLite
echo "4. Menyediakan fail pangkalan data SQLite..."
mkdir -p database
touch database/database.sqlite
echo "   -> Fail 'database/database.sqlite' sedia untuk digunakan."

# Langkah 5: Pasang Kebergantungan & Sediakan Laravel
echo "5. Memasang kebergantungan Composer & menyediakan aplikasi..."
composer install --no-dev --optimize-autoloader
php artisan key:generate

# Langkah 6: Migrasi & Penyediaan Shield
echo "6. Menjalankan migrasi & menjana kebenaran Shield..."
php artisan migrate --force
php artisan shield:generate --all --panel=admin --no-interaction
php artisan db:seed --class=ProductionSeeder --force

# Langkah 7: Bina Aset Frontend
echo "7. Membina aset frontend..."
npm install
npm run build

# Langkah 8: Optimumkan untuk Produksi
echo "8. Mengoptimumkan cache untuk produksi..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link

echo "✅ Pemasangan automatik selesai!"