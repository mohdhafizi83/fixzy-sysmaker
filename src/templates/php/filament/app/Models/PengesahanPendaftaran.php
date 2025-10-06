<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use OwenIt\Auditing\Contracts\Auditable; //fizisysmaker:filament-auditing
use OwenIt\Auditing\Auditable as AuditableTrait; //fizisysmaker:filament-auditing

class PengesahanPendaftaran extends Model implements Auditable //fizisysmaker:filament-auditing
{
	use HasFactory, AuditableTrait; //fizisysmaker:filament-auditing
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'pengesahan_pendaftaran';
    /**
     * Kunci utama untuk model ini.
     *
     * @var string
     */
    protected $primaryKey = 'id_pengesahan';
    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'pendaftaran_id',
        'user_id',
        'status_baharu',
        'catatan',
        'tarikh_tindakan',
    ];
	
// Pengesahan ini milik satu pendaftaran
//fizisysmaker:relationship
public function pendaftaranKursus()
{
    return $this->belongsTo(PendaftaranKursus::class, 'pendaftaran_id', 'id_pendaftaran');
}

//fizisysmaker:relationship
public function user()
{
    return $this->belongsTo(User::class, 'user_id', 'id');
}
}
