<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Fakulti;
use App\Models\Pelajar;
use App\Models\ProfilPelajar;
use App\Models\DokumenPelajar;
use App\Models\Kursus;
use App\Models\PendaftaranKursus;
use App\Models\PengesahanPendaftaran;
use App\Models\KeputusanUjian;
use App\Models\Invoice;

class DatabaseSeeder extends Seeder {
    public function run(): void {
        // 1. Cipta Pengguna Ujian (Super Admin)
        $user = User::firstOrCreate(
            ['email' => 'admin@admin.com'],
            ['name' => 'Super Admin', 'password' => bcrypt('password')]
        );

        // Tugaskan Peranan (Role) Super Admin
        $role = \Spatie\Permission\Models\Role::firstOrCreate([
            'name' => 'super_admin',
            'guard_name' => 'web'
        ]);
        $user->assignRole($role);


        // Seed Fakulti (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                Fakulti::factory()->create();
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Seed Pelajar (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                Pelajar::factory()->create([
                    'fakulti_id' => Fakulti::inRandomOrder()->first()?->id ?? null
                ]);
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Seed ProfilPelajar (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                ProfilPelajar::factory()->create([
                    'pelajar_id' => Pelajar::inRandomOrder()->first()?->id ?? null
                ]);
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Seed DokumenPelajar (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                DokumenPelajar::factory()->create([
                    'pelajar_id' => Pelajar::inRandomOrder()->first()?->id ?? null
                ]);
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Seed Kursus (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                Kursus::factory()->create([
                    'prasyarat_kursus_id' => Kursus::inRandomOrder()->first()?->id ?? null
                ]);
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Seed PendaftaranKursus (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                PendaftaranKursus::factory()->create([
                    'pelajar_id' => Pelajar::inRandomOrder()->first()?->id ?? null,
                    'kursus_id' => Kursus::inRandomOrder()->first()?->id ?? null
                ]);
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Seed PengesahanPendaftaran (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                PengesahanPendaftaran::factory()->create([
                    'pendaftaran_id' => PendaftaranKursus::inRandomOrder()->first()?->id ?? null,
                    'user_id' => 1
                ]);
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Seed KeputusanUjian (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                KeputusanUjian::factory()->create([
                    'pelajar_id' => Pelajar::inRandomOrder()->first()?->id ?? null
                ]);
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Seed Invoice (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                Invoice::factory()->create([
                    'fakulti_id' => Fakulti::inRandomOrder()->first()?->id ?? null
                ]);
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Filament Shield Security
        $this->call(ShieldSeeder::class);
    }
}