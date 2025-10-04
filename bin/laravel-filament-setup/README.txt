Langkah Pemasangan Semula Projek Laravel [Filament]:
1. Copy basic files
2. cd myproject
3. cp .env.example .env
4. composer install --optimize-autoloader ## composer install --no-dev --optimize-autoloader (untuk production)
5. php artisan key:generate
6. php artisan migrate --force
7. php artisan shield:generate --all --panel=admin --no-interaction
8. php artisan db:seed
9. npm install
10. npm run build
11. php artisan config:cache
12. php artisan route:cache
13. php artisan view:cache
14. php artisan storage:link
15. php artisan serve

Klik launcher.bat untuk memasang laravel[filament] secara automatik.
Prasyarat: Pastikan PHP, Composer, Node.js (npm), dan MySQL Client telah dipasang pada mesin Windows anda dan boleh diakses melalui Command Prompt (iaitu, laluan mereka telah ditambah ke dalam pembolehubah persekitaran PATH sistem).