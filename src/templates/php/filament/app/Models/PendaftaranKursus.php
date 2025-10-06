<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use OwenIt\Auditing\Contracts\Auditable; //fizisysmaker:filament-auditing
use OwenIt\Auditing\Auditable as AuditableTrait; //fizisysmaker:filament-auditing

class PendaftaranKursus extends Model implements Auditable //fizisysmaker:filament-auditing
{
	use HasFactory, AuditableTrait;
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'pendaftaran_kursus';
    /**
     * Kunci utama untuk model ini.
     *
     * @var string
     */
    protected $primaryKey = 'id_pendaftaran';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'pelajar_id',
        'kursus_id',
        'tarikh_pendaftaran',
        'gred',
        'status',
    ];	
	
// Pendaftaran ini milik seorang pelajar
//fizisysmaker:relationship
public function pelajar()
{
    return $this->belongsTo(Pelajar::class, 'pelajar_id', 'id_pelajar');
}

// Pendaftaran ini adalah untuk satu kursus
//fizisysmaker:relationship
public function kursus()
{
    return $this->belongsTo(Kursus::class, 'kursus_id', 'id_kursus');
}

// Pendaftaran ini mempunyai satu pengesahan
//fizisysmaker:relationship
public function pengesahanPendaftaran()
{
    return $this->hasOne(PengesahanPendaftaran::class, 'pendaftaran_id', 'id_pendaftaran');
}
}
