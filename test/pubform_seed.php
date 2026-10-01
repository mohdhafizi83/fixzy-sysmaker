<?php
// Seeds parent lookup rows for the public-form matrix app (run with cwd=appDir).
$base = getcwd();
require $base . '/vendor/autoload.php';
$app = require_once $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

DB::table('watak')->insert([
    ['nama_watak' => 'Watak Satu', 'created_at' => now(), 'updated_at' => now()],
    ['nama_watak' => 'Watak Dua', 'created_at' => now(), 'updated_at' => now()],
    ['nama_watak' => 'Watak Tiga', 'created_at' => now(), 'updated_at' => now()],
]);
echo "seeded watak: " . DB::table('watak')->count() . "\n";
