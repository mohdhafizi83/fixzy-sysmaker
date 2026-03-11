<?php

declare(strict_types=1);

namespace App\Policies;

use Illuminate\Foundation\Auth\User as AuthUser;
use App\Models\PendaftaranKursus;
use Illuminate\Auth\Access\HandlesAuthorization;

class PendaftaranKursusPolicy
{
    use HandlesAuthorization;
    
    public function viewAny(AuthUser $authUser): bool
    {
        return $authUser->can('ViewAny:PendaftaranKursus');
    }

    public function view(AuthUser $authUser, PendaftaranKursus $pendaftaranKursus): bool
    {
        return $authUser->can('View:PendaftaranKursus');
    }

    public function create(AuthUser $authUser): bool
    {
        return $authUser->can('Create:PendaftaranKursus');
    }

    public function update(AuthUser $authUser, PendaftaranKursus $pendaftaranKursus): bool
    {
        return $authUser->can('Update:PendaftaranKursus');
    }

    public function delete(AuthUser $authUser, PendaftaranKursus $pendaftaranKursus): bool
    {
        return $authUser->can('Delete:PendaftaranKursus');
    }

    public function restore(AuthUser $authUser, PendaftaranKursus $pendaftaranKursus): bool
    {
        return $authUser->can('Restore:PendaftaranKursus');
    }

    public function forceDelete(AuthUser $authUser, PendaftaranKursus $pendaftaranKursus): bool
    {
        return $authUser->can('ForceDelete:PendaftaranKursus');
    }

    public function forceDeleteAny(AuthUser $authUser): bool
    {
        return $authUser->can('ForceDeleteAny:PendaftaranKursus');
    }

    public function restoreAny(AuthUser $authUser): bool
    {
        return $authUser->can('RestoreAny:PendaftaranKursus');
    }

    public function replicate(AuthUser $authUser, PendaftaranKursus $pendaftaranKursus): bool
    {
        return $authUser->can('Replicate:PendaftaranKursus');
    }

    public function reorder(AuthUser $authUser): bool
    {
        return $authUser->can('Reorder:PendaftaranKursus');
    }

}