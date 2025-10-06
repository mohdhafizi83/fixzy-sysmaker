<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use OwenIt\Auditing\Contracts\Auditable; //fizisysmaker:filament-auditing
use OwenIt\Auditing\Auditable as AuditableTrait; //fizisysmaker:filament-auditing

class DokumenPelajar extends Model implements Auditable //fizisysmaker:filament-auditing
{
	use HasFactory, AuditableTrait;
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'dokumen_pelajar';
    /**
     * Kunci utama untuk model ini.
     *
     * @var string
     */
    protected $primaryKey = 'id_dokumen'; 
    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'pelajar_id',
        'nama_fail',
        'path_fail',
        'jenis_dokumen',
        'tarikh_muatnaik',
    ];	
// Dokumen ini milik seorang pelajar
//fizisysmaker:relationship
public function pelajar()
{
    return $this->belongsTo(Pelajar::class, 'pelajar_id', 'id_pelajar');
}
}
