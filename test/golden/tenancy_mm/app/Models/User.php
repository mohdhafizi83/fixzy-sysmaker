<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;
use OwenIt\Auditing\Auditable as AuditableTrait;
use Filament\Models\Contracts\HasTenants;
use Illuminate\Support\Collection;
use Illuminate\Database\Eloquent\Model;
use Filament\Panel;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class User extends Authenticatable implements Auditable, HasTenants
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasRoles, AuditableTrait, SoftDeletes;

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
    public function organisasis(): BelongsToMany
    {
        return $this->belongsToMany(\App\Models\Organisasi::class, 'organisasi_user');
    }

    public function getTenants(Panel $panel): array|Collection
    {
        return $this->organisasis;
    }

    public function canAccessTenant(Model $tenant): bool
    {
        return $this->organisasis()->whereKey($tenant)->exists();
    }


}
