<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class ShieldSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // 1. Cipta peranan 'super_admin'
        $superAdminRole = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);

        // 2. Dapatkan SEMUA kebenaran yang wujud dalam pangkalan data
        $allPermissions = Permission::all();

        // 3. Berikan semua kebenaran ini kepada peranan 'super_admin'
        // Ini akan memastikan semua checkbox ditandakan (checked) di UI
        $superAdminRole->syncPermissions($allPermissions);

        // 4. Berikan peranan 'super_admin' kepada pengguna lalai anda
        $user = User::where('email', 'test@example.com')->first();
        if ($user) {
            $user->assignRole($superAdminRole);
        }

        $this->command->info('Super admin role has been granted all permissions and assigned to the default user.');
    }
}