<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Aset;

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


        // Seed Aset (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                Aset::factory()->create();
            } catch (\Exception $e) {
                // Abaikan jika data duplikat atau langgar Unique Constraint
            }
        }

        // Filament Shield Security
        $this->call(ShieldSeeder::class);
    }
}