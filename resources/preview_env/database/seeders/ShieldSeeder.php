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

        // 1. Create the 'super_admin' role
        $superAdminRole = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);

        // 2. Fetch ALL permissions that exist in the database
        $allPermissions = Permission::all();

        // 3. Grant all these permissions to the 'super_admin' role
        // This ensures all checkboxes are marked (checked) in the UI
        $superAdminRole->syncPermissions($allPermissions);

        // 4. Assign the 'super_admin' role to the default user
        $user = User::where('email', 'test@example.com')->first();
        if ($user) {
            $user->assignRole($superAdminRole);
        }

        $this->command->info('Super admin role has been granted all permissions and assigned to the default user.');
    }
}