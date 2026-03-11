<?php

declare(strict_types=1);

namespace App\Policies;

use Illuminate\Foundation\Auth\User as AuthUser;
use App\Models\Kursus;
use Illuminate\Auth\Access\HandlesAuthorization;

class KursusPolicy
{
    use HandlesAuthorization;
    
    public function viewAny(AuthUser $authUser): bool
    {
        return $authUser->can('ViewAny:Kursus');
    }

    public function view(AuthUser $authUser, Kursus $kursus): bool
    {
        return $authUser->can('View:Kursus');
    }

    public function create(AuthUser $authUser): bool
    {
        return $authUser->can('Create:Kursus');
    }

    public function update(AuthUser $authUser, Kursus $kursus): bool
    {
        return $authUser->can('Update:Kursus');
    }

    public function delete(AuthUser $authUser, Kursus $kursus): bool
    {
        return $authUser->can('Delete:Kursus');
    }

    public function restore(AuthUser $authUser, Kursus $kursus): bool
    {
        return $authUser->can('Restore:Kursus');
    }

    public function forceDelete(AuthUser $authUser, Kursus $kursus): bool
    {
        return $authUser->can('ForceDelete:Kursus');
    }

    public function forceDeleteAny(AuthUser $authUser): bool
    {
        return $authUser->can('ForceDeleteAny:Kursus');
    }

    public function restoreAny(AuthUser $authUser): bool
    {
        return $authUser->can('RestoreAny:Kursus');
    }

    public function replicate(AuthUser $authUser, Kursus $kursus): bool
    {
        return $authUser->can('Replicate:Kursus');
    }

    public function reorder(AuthUser $authUser): bool
    {
        return $authUser->can('Reorder:Kursus');
    }

}