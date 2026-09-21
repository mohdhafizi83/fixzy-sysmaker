<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;
use OwenIt\Auditing\Auditable as AuditableTrait;

class Pelajar extends Model implements Auditable
{
	use HasFactory;
    use AuditableTrait;
    use SoftDeletes;
    /**
     *
     * @var string
     */
    protected $table = 'pelajar';
    /**
     *
     * @var string
     */
    protected $primaryKey = 'id';
    /**
     *
     * @var array<int, string>
     */
    protected $fillable = [
        
        'fakulti_id',
        'nama_penuh',
        'no_matrik',
        'email',
        'tarikh_daftar',
        'gambar_profil',
        'surat_tawaran'
    
    ];
    

    protected function casts(): array
    {
        return [
            'email' => 'array',
        ];
    }
    


    public function profilPelajar()
    {
        return $this->hasOne(ProfilPelajar::class, 'pelajar_id', 'id');
    }
    public function dokumenPelajars()
    {
        return $this->hasMany(DokumenPelajar::class, 'pelajar_id', 'id');
    }
    public function pendaftaranKursuses()
    {
        return $this->hasMany(PendaftaranKursus::class, 'pelajar_id', 'id');
    }
    public function keputusanUjians()
    {
        return $this->hasMany(KeputusanUjian::class, 'pelajar_id', 'id');
    }
    public function fakulti()
    {
        return $this->belongsTo(Fakulti::class, 'fakulti_id', 'id');
    }	




}
