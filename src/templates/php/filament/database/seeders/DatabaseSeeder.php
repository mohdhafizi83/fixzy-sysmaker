<?php

namespace Database\Seeders;

use App\Models\User;

use App\Models\Kursus;
use App\Models\Pelajar;
use App\Models\ProfilPelajar;
use App\Models\DokumenPelajar;
use App\Models\PendaftaranKursus;
use App\Models\PengesahanPendaftaran;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
public function run(): void
{
    User::factory()->create([
        'name' => 'Test User',
        'email' => 'test@example.com',
    ]);
    
    // 1. Cipta 10 kursus
    $kursuses = Kursus::factory(10)->create([
        'prasyarat_kursus_id' => null,
    ]);

    // 2. Kemas kini prasyarat
    // DIBAIKI: Rujuk kepada kunci utama yang betul ->id_kursus
    foreach ($kursuses as $kursus) {
        $prasyaratPool = $kursuses->where('id_kursus', '!=', $kursus->id_kursus);

        if ($prasyaratPool->isNotEmpty()) {
            $prasyaratId = $prasyaratPool->random()->id_kursus;
            $kursus->update(['prasyarat_kursus_id' => $prasyaratId]);
        }
    }

    // 3. Cipta 50 pelajar
    $pelajars = Pelajar::factory(50)
        ->has(ProfilPelajar::factory())
        ->has(DokumenPelajar::factory()->count(3))
        ->create();

    // 4. Cipta pendaftaran
    foreach ($pelajars as $pelajar) {
        PendaftaranKursus::factory()->create([
            // DIBAIKI: Guna ->id_pelajar bukannya ->id
            'pelajar_id' => $pelajar->id_pelajar,
            // DIBAIKI: Guna ->id_kursus bukannya ->id
            'kursus_id' => $kursuses->random()->id_kursus,
        ]);
    }

	$users = User::all();
    // 5. Cipta pengesahan
    foreach (PendaftaranKursus::all() as $pendaftaran) {
        PengesahanPendaftaran::factory()->create([
        'pendaftaran_id' => $pendaftaran->id_pendaftaran,
        'user_id' => $users->random()->id, // Mengambil id user secara rawak
    ]);
    }
	
$this->call(ShieldSeeder::class);
}
}
