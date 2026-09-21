<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\SemuaField;

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


        // Seed SemuaField (Kalis Ralat Unique Constraint)
        for ($i = 0; $i < 20; $i++) {
            try {
                SemuaField::factory()->create();
            } catch (\Exception $e) {
                // Ignore if data is duplicated or violates a Unique Constraint
            }
        }

        // Filament Shield Security
        $this->call(ShieldSeeder::class);
    }
}