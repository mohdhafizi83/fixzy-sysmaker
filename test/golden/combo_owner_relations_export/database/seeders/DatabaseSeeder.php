<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Pelanggan;
use App\Models\Tempahan;
use App\Models\ItemTempahan;

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


        // Seed Pelanggan (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                Pelanggan::factory()->create();
            } catch (\Exception $e) {
                // Abaikan jika data duplikat atau langgar Unique Constraint
            }
        }

        // Seed Tempahan (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                Tempahan::factory()->create([
                    'pelanggan_id' => Pelanggan::inRandomOrder()->first()?->id ?? null
                ]);
            } catch (\Exception $e) {
                // Abaikan jika data duplikat atau langgar Unique Constraint
            }
        }

        // Seed ItemTempahan (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                ItemTempahan::factory()->create([
                    'tempahan_id' => Tempahan::inRandomOrder()->first()?->id ?? null
                ]);
            } catch (\Exception $e) {
                // Abaikan jika data duplikat atau langgar Unique Constraint
            }
        }

        // Filament Shield Security
        $this->call(ShieldSeeder::class);
    }
}