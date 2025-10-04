#!/bin/bash

# Hentikan skrip jika berlaku sebarang ralat
set -e

# --- KONFIGURASI (Ubah mengikut keperluan) ---
GIT_REPO_URL="https://github.com/nama-anda/projek-anda.git"
GENERATED_DIR="/path/to/low-code-output"
PROJECT_DIR="/var/www/my-new-project"

# -- KONFIGURASI POSTGRESQL --
PG_ADMIN_USER="postgres" # Pengguna superuser PostgreSQL anda
PG_ADMIN_PASS="root_password" # Kata laluan superuser PostgreSQL
DB_NAME="project_db_$(date +%s)" # Contoh nama DB unik
DB_USER="project_user"
DB_PASS="PasswordSelamatYangTelahDitetapkan"


# --- MULA PROSES AUTOMASI ---

echo "🚀 Memulakan proses pemasangan automatik untuk PostgreSQL..."

# LANGKAH 1: Muat turun templat asas dari Git
echo "1. Memuat turun templat asas dari repositori Git..."
if [ -d "$PROJECT_DIR" ]; then
    rm -rf "$PROJECT_DIR"
fi
git clone "$GIT_REPO_URL" "$PROJECT_DIR"

# Langkah 2: Salin fail dari aplikasi low-code
echo "2. Menyalin fail dari direktori janaan..."
mkdir -p $PROJECT_DIR
rsync -av --delete $GENERATED_DIR/ $PROJECT_DIR/

cd $PROJECT_DIR

# Langkah 3: Sediakan & Konfigurasi .env untuk PostgreSQL
echo "3. Menyediakan fail .env untuk PostgreSQL..."
if [ ! -f ".env" ]; then
    cp .env.example .env
fi

# Guna 'sed' untuk menukar koneksi ke pgsql dan mengisi butiran
sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=pgsql/' .env
sed -i 's/^DB_HOST=.*/DB_HOST=127.0.0.1/' .env
sed -i 's/^DB_PORT=.*/DB_PORT=5432/' .env
sed -i "s/^DB_DATABASE=.*/DB_DATABASE=${DB_NAME}/" .env
sed -i "s/^DB_USERNAME=.*/DB_USERNAME=${DB_USER}/" .env
sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${DB_PASS}/" .env
echo "   -> Fail .env telah dikonfigurasi."

# Langkah 4: Sediakan Pangkalan Data & Pengguna di PostgreSQL
echo "4. Menyediakan pangkalan data & pengguna di PostgreSQL..."
# Guna PGPASSWORD untuk mengelak prompt kata laluan
export PGPASSWORD=$PG_ADMIN_PASS

# Periksa jika pengguna sudah wujud, jika tidak, cipta
if ! psql -U "$PG_ADMIN_USER" -h localhost -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    psql -U "$PG_ADMIN_USER" -h localhost -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    echo "   -> Pengguna '$DB_USER' telah dicipta."
else
    echo "   -> Pengguna '$DB_USER' sudah wujud."
fi

# Periksa jika pangkalan data sudah wujud, jika tidak, cipta
if ! psql -U "$PG_ADMIN_USER" -h localhost -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    psql -U "$PG_ADMIN_USER" -h localhost -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    echo "   -> Pangkalan data '$DB_NAME' telah dicipta."
else
    echo "   -> Pangkalan data '$DB_NAME' sudah wujud."
fi

# Kosongkan kata laluan dari environment variable
unset PGPASSWORD
echo "   -> Pangkalan data PostgreSQL sedia untuk digunakan."

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