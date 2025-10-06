<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

use OwenIt\Auditing\Contracts\Auditable; //fizisysmaker:filament-auditing
use OwenIt\Auditing\Auditable as AuditableTrait; //fizisysmaker:filament-auditing

class Pelajar extends Model implements Auditable //fizisysmaker:filament-auditing
{
	use HasFactory, AuditableTrait, SoftDeletes; //fizisysmaker:filament-auditing
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'pelajar';
    /**
     * Kunci utama untuk model ini.
     *
     * @var string
     */
    protected $primaryKey = 'id_pelajar';
    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'nama_penuh',
        'no_matrik',
        'email',
        'tarikh_daftar',
        'gambar_profil',
    ];	
// Seorang pelajar mempunyai satu profil
//fizisysmaker:relationship
public function profilPelajar()
{
    // Parameter 1: Model yang dihubungkan ('ProfilPelajar')
    // Parameter 2: Nama kunci asing (foreign key) dalam jadual 'profil_pelajar'
    // Parameter 3: Nama kunci utama (local key) dalam jadual INI ('pelajar')
    return $this->hasOne(ProfilPelajar::class, 'pelajar_id', 'id_pelajar');
}

// Seorang pelajar mempunyai banyak dokumen
//fizisysmaker:relationship
public function dokumenPelajar()
{
    return $this->hasMany(DokumenPelajar::class, 'pelajar_id', 'id_pelajar');
}

// Seorang pelajar mempunyai banyak pendaftaran kursus
//fizisysmaker:relationship
public function pendaftaranKursus()
{
    return $this->hasMany(PendaftaranKursus::class, 'pelajar_id', 'id_pelajar');
}
}
