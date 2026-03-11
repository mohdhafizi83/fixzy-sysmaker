<?php

declare(strict_types=1);

namespace App\Policies;

use Illuminate\Foundation\Auth\User as AuthUser;
use App\Models\DokumenPelajar;
use Illuminate\Auth\Access\HandlesAuthorization;

class DokumenPelajarPolicy
{
    use HandlesAuthorization;
    
    public function viewAny(AuthUser $authUser): bool
    {
        return $authUser->can('ViewAny:DokumenPelajar');
    }

    public function view(AuthUser $authUser, DokumenPelajar $dokumenPelajar): bool
    {
        return $authUser->can('View:DokumenPelajar');
    }

    public function create(AuthUser $authUser): bool
    {
        return $authUser->can('Create:DokumenPelajar');
    }

    public function update(AuthUser $authUser, DokumenPelajar $dokumenPelajar): bool
    {
        return $authUser->can('Update:DokumenPelajar');
    }

    public function delete(AuthUser $authUser, DokumenPelajar $dokumenPelajar): bool
    {
        return $authUser->can('Delete:DokumenPelajar');
    }

    public function restore(AuthUser $authUser, DokumenPelajar $dokumenPelajar): bool
    {
        return $authUser->can('Restore:DokumenPelajar');
    }

    public function forceDelete(AuthUser $authUser, DokumenPelajar $dokumenPelajar): bool
    {
        return $authUser->can('ForceDelete:DokumenPelajar');
    }

    public function forceDeleteAny(AuthUser $authUser): bool
    {
        return $authUser->can('ForceDeleteAny:DokumenPelajar');
    }

    public function restoreAny(AuthUser $authUser): bool
    {
        return $authUser->can('RestoreAny:DokumenPelajar');
    }

    public function replicate(AuthUser $authUser, DokumenPelajar $dokumenPelajar): bool
    {
        return $authUser->can('Replicate:DokumenPelajar');
    }

    public function reorder(AuthUser $authUser): bool
    {
        return $authUser->can('Reorder:DokumenPelajar');
    }

}