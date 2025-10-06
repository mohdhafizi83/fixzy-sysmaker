<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use OwenIt\Auditing\Contracts\Auditable; //fizisysmaker:filament-auditing
use OwenIt\Auditing\Auditable as AuditableTrait; //fizisysmaker:filament-auditing

class ProfilPelajar extends Model implements Auditable //fizisysmaker:filament-auditing
{
	use HasFactory, AuditableTrait;
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'profil_pelajar';
    /**
     * Kunci utama untuk model ini.
     *
     * @var string
     */
    protected $primaryKey = 'id_profil';
    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'pelajar_id',
        'alamat',
        'no_telefon',
        'tarikh_lahir',
        'info_kecemasan',
    ];	
// Profil ini milik seorang pelajar
//fizisysmaker:relationship
public function pelajar()
{
    // Parameter 1: Model yang dihubungkan
    // Parameter 2: Nama kunci asing (foreign key) dalam jadual INI ('profil_pelajar')
    // Parameter 3: Nama kunci utama (owner key) dalam jadual INDUK ('pelajar')
    return $this->belongsTo(Pelajar::class, 'pelajar_id', 'id_pelajar');
}
}
