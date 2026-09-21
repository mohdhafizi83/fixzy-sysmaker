<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\HasAudits;


class PendaftaranKursus extends Model 
{
	use HasFactory;
    use HasAudits;
    use SoftDeletes;
    
    
    /**
     *
     * @var string
     */
    protected $table = 'pendaftaran_kursus';
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
        
        'pelajar_id',
        'kursus_id',
        'tarikh_pendaftaran',
        'gred',
        'dokumen_lengkap'
    
    ];
    
    


    public function pengesahanPendaftaran()
    {
        return $this->hasOne(PengesahanPendaftaran::class, 'pendaftaran_id', 'id');
    }
    public function pelajar()
    {
        return $this->belongsTo(Pelajar::class, 'pelajar_id', 'id');
    }
    public function kursus()
    {
        return $this->belongsTo(Kursus::class, 'kursus_id', 'id');
    }	




}
