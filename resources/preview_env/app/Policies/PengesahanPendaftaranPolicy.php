<?php

declare(strict_types=1);

namespace App\Policies;

use Illuminate\Foundation\Auth\User as AuthUser;
use App\Models\PengesahanPendaftaran;
use Illuminate\Auth\Access\HandlesAuthorization;

class PengesahanPendaftaranPolicy
{
    use HandlesAuthorization;
    
    public function viewAny(AuthUser $authUser): bool
    {
        return $authUser->can('ViewAny:PengesahanPendaftaran');
    }

    public function view(AuthUser $authUser, PengesahanPendaftaran $pengesahanPendaftaran): bool
    {
        return $authUser->can('View:PengesahanPendaftaran');
    }

    public function create(AuthUser $authUser): bool
    {
        return $authUser->can('Create:PengesahanPendaftaran');
    }

    public function update(AuthUser $authUser, PengesahanPendaftaran $pengesahanPendaftaran): bool
    {
        return $authUser->can('Update:PengesahanPendaftaran');
    }

    public function delete(AuthUser $authUser, PengesahanPendaftaran $pengesahanPendaftaran): bool
    {
        return $authUser->can('Delete:PengesahanPendaftaran');
    }

    public function restore(AuthUser $authUser, PengesahanPendaftaran $pengesahanPendaftaran): bool
    {
        return $authUser->can('Restore:PengesahanPendaftaran');
    }

    public function forceDelete(AuthUser $authUser, PengesahanPendaftaran $pengesahanPendaftaran): bool
    {
        return $authUser->can('ForceDelete:PengesahanPendaftaran');
    }

    public function forceDeleteAny(AuthUser $authUser): bool
    {
        return $authUser->can('ForceDeleteAny:PengesahanPendaftaran');
    }

    public function restoreAny(AuthUser $authUser): bool
    {
        return $authUser->can('RestoreAny:PengesahanPendaftaran');
    }

    public function replicate(AuthUser $authUser, PengesahanPendaftaran $pengesahanPendaftaran): bool
    {
        return $authUser->can('Replicate:PengesahanPendaftaran');
    }

    public function reorder(AuthUser $authUser): bool
    {
        return $authUser->can('Reorder:PengesahanPendaftaran');
    }

}