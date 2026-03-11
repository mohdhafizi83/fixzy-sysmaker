<?php

declare(strict_types=1);

namespace App\Policies;

use Illuminate\Foundation\Auth\User as AuthUser;
use App\Models\Pelajar;
use Illuminate\Auth\Access\HandlesAuthorization;

class PelajarPolicy
{
    use HandlesAuthorization;
    
    public function viewAny(AuthUser $authUser): bool
    {
        return $authUser->can('ViewAny:Pelajar');
    }

    public function view(AuthUser $authUser, Pelajar $pelajar): bool
    {
        return $authUser->can('View:Pelajar');
    }

    public function create(AuthUser $authUser): bool
    {
        return $authUser->can('Create:Pelajar');
    }

    public function update(AuthUser $authUser, Pelajar $pelajar): bool
    {
        return $authUser->can('Update:Pelajar');
    }

    public function delete(AuthUser $authUser, Pelajar $pelajar): bool
    {
        return $authUser->can('Delete:Pelajar');
    }

    public function restore(AuthUser $authUser, Pelajar $pelajar): bool
    {
        return $authUser->can('Restore:Pelajar');
    }

    public function forceDelete(AuthUser $authUser, Pelajar $pelajar): bool
    {
        return $authUser->can('ForceDelete:Pelajar');
    }

    public function forceDeleteAny(AuthUser $authUser): bool
    {
        return $authUser->can('ForceDeleteAny:Pelajar');
    }

    public function restoreAny(AuthUser $authUser): bool
    {
        return $authUser->can('RestoreAny:Pelajar');
    }

    public function replicate(AuthUser $authUser, Pelajar $pelajar): bool
    {
        return $authUser->can('Replicate:Pelajar');
    }

    public function reorder(AuthUser $authUser): bool
    {
        return $authUser->can('Reorder:Pelajar');
    }

}