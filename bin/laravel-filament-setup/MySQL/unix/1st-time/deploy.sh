#!/bin/bash

# Hentikan skrip jika berlaku sebarang ralat
set -e

# --- KONFIGURASI (Ubah mengikut keperluan) ---
GIT_REPO_URL="https://github.com/nama-anda/projek-anda.git"
GENERATED_DIR="/path/to/low-code-output"
PROJECT_DIR="/var/www/my-new-project"
DB_NAME="project_db_$(date +%s)" # Contoh nama DB unik
DB_USER="project_user"
DB_PASS="PasswordSelamatYangTelahDitetapkan"


# --- MULA PROSES AUTOMASI ---

echo "🚀 Memulakan proses pemasangan automatik..."

# LANGKAH 1: Muat turun templat asas dari Git
echo "1. Memuat turun templat asas dari repositori Git..."
if [ -d "$PROJECT_DIR" ]; then
    rm -rf "$PROJECT_DIR"
fi
git clone "$GIT_REPO_URL" "$PROJECT_DIR"

# Langkah 2: Salin fail dari aplikasi low-code
# 'rsync' lebih baik dari 'cp' kerana lebih laju untuk kemas kini
echo "2. Menyalin fail dari direktori janaan..."
mkdir -p $PROJECT_DIR
rsync -av --delete $GENERATED_DIR/ $PROJECT_DIR/

cd $PROJECT_DIR

# Langkah 3: Sediakan & Konfigurasi .env secara automatik
echo "3. Menyediakan fail .env..."
if [ ! -f ".env" ]; then
    cp .env.example .env
fi

# Guna 'sed' untuk menggantikan pembolehubah dalam .env
sed -i "s/^DB_DATABASE=.*/DB_DATABASE=${DB_NAME}/" .env
sed -i "s/^DB_USERNAME=.*/DB_USERNAME=${DB_USER}/" .env
sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${DB_PASS}/" .env
echo "   -> Fail .env telah dikonfigurasi."

# Langkah 4: Sediakan Pangkalan Data (Contoh untuk MySQL)
# Skrip perlu ada akses ke DB server untuk langkah ini
echo "4. Menyediakan pangkalan data di server..."
mysql -u root -p'root_password' -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};"
mysql -u root -p'root_password' -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -u root -p'root_password' -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
mysql -u root -p'root_password' -e "FLUSH PRIVILEGES;"
echo "   -> Pangkalan data '${DB_NAME}' sedia untuk digunakan."

# Langkah 5: Pasang Kebergantungan & Sediakan Laravel
echo "5. Memasang kebergantungan Composer & menyediakan aplikasi..."
composer install --no-dev --optimize-autoloader
php artisan key:generate

# Langkah 6: Migrasi & Penyediaan Shield
echo "6. Menjalankan migrasi & menjana kebenaran Shield..."
php artisan migrate --force
php artisan shield:generate --all --panel=admin --no-interaction
php artisan db:seed

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