<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Sekolah;
use App\Models\Kela;

class DatabaseSeeder extends Seeder {
    public function run(): void {
        // 1. Create Test User (Super Admin)
        $user = User::firstOrCreate(
            ['email' => 'admin@admin.com'],
            ['name' => 'Super Admin', 'password' => bcrypt('password')]
        );

        // Assign the Super Admin Role
        $role = \Spatie\Permission\Models\Role::firstOrCreate([
            'name' => 'super_admin',
            'guard_name' => 'web'
        ]);
        $user->assignRole($role);


        // Seed Sekolah (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                Sekolah::factory()->create();
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Seed Kela (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                Kela::factory()->create([
                    'sekolah_id' => Sekolah::inRandomOrder()->first()?->id ?? null
                ]);
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Filament Shield Security
        $this->call(ShieldSeeder::class);
    }
}