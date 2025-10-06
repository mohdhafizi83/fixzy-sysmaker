<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles; //fizisysmaker:filament-auditing
use OwenIt\Auditing\Contracts\Auditable; //fizisysmaker:filament-auditing
use OwenIt\Auditing\Auditable as AuditableTrait; //fizisysmaker:filament-auditing

class User extends Authenticatable implements Auditable //fizisysmaker:filament-auditing
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasRoles, AuditableTrait; //fizisysmaker:filament-auditing

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

//fizisysmaker:relationship	
public function pengesahanKursus()
{
    return $this->hasMany(PengesahanKursus::class, 'user_id', 'id');
}
}
