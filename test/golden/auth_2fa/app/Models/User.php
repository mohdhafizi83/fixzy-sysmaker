<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\HasAudits;

use Filament\Auth\MultiFactor\Email\Contracts\HasEmailAuthentication;

class User extends Authenticatable implements HasEmailAuthentication
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasRoles, HasAudits, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Email two-factor authentication is enabled project-wide
     * (Fixzy SysMaker: module_auth_email_2fa).
     */
    public function hasEmailAuthentication(): bool
    {
        return true;
    }

    public function toggleEmailAuthentication(bool $condition): void
    {
        // Project-wide enforcement: the setting cannot be toggled per user.
    }
}
