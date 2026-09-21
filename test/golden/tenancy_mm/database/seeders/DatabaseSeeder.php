<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Organisasi;
use App\Models\Produk;

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


        // Seed Organisasi (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                Organisasi::factory()->create();
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Seed Produk (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                Produk::factory()->create([
                    'organisasi_id' => Organisasi::inRandomOrder()->first()?->id ?? null
                ]);
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Filament Shield Security
        $this->call(ShieldSeeder::class);
    }
}