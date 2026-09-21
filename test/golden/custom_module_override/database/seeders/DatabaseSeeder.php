<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Fakulti;

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

        // Filament Shield Security
        $this->call(ShieldSeeder::class);
    }
}