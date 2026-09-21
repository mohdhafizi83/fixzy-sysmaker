<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\HasAudits;


class PengesahanPendaftaran extends Model 
{
	use HasFactory;
    use HasAudits;
    use SoftDeletes;
    
    
    /**
     *
     * @var string
     */
    protected $table = 'pengesahan_pendaftaran';
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
        
        'pendaftaran_id',
        'user_id',
        'status',
        'catatan',
        'tarikh_tindakan'
    
    ];
    
    


    public function pendaftaranKursus()
    {
        return $this->belongsTo(PendaftaranKursus::class, 'pendaftaran_id', 'id');
    }
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }	




}
