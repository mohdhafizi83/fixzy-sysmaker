<?php

declare(strict_types=1);

namespace App\Policies;

use Illuminate\Foundation\Auth\User as AuthUser;
use App\Models\ProfilPelajar;
use Illuminate\Auth\Access\HandlesAuthorization;

class ProfilPelajarPolicy
{
    use HandlesAuthorization;
    
    public function viewAny(AuthUser $authUser): bool
    {
        return $authUser->can('ViewAny:ProfilPelajar');
    }

    public function view(AuthUser $authUser, ProfilPelajar $profilPelajar): bool
    {
        return $authUser->can('View:ProfilPelajar');
    }

    public function create(AuthUser $authUser): bool
    {
        return $authUser->can('Create:ProfilPelajar');
    }

    public function update(AuthUser $authUser, ProfilPelajar $profilPelajar): bool
    {
        return $authUser->can('Update:ProfilPelajar');
    }

    public function delete(AuthUser $authUser, ProfilPelajar $profilPelajar): bool
    {
        return $authUser->can('Delete:ProfilPelajar');
    }

    public function restore(AuthUser $authUser, ProfilPelajar $profilPelajar): bool
    {
        return $authUser->can('Restore:ProfilPelajar');
    }

    public function forceDelete(AuthUser $authUser, ProfilPelajar $profilPelajar): bool
    {
        return $authUser->can('ForceDelete:ProfilPelajar');
    }

    public function forceDeleteAny(AuthUser $authUser): bool
    {
        return $authUser->can('ForceDeleteAny:ProfilPelajar');
    }

    public function restoreAny(AuthUser $authUser): bool
    {
        return $authUser->can('RestoreAny:ProfilPelajar');
    }

    public function replicate(AuthUser $authUser, ProfilPelajar $profilPelajar): bool
    {
        return $authUser->can('Replicate:ProfilPelajar');
    }

    public function reorder(AuthUser $authUser): bool
    {
        return $authUser->can('Reorder:ProfilPelajar');
    }

}