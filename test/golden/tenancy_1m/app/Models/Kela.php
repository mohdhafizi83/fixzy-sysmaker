<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;
use OwenIt\Auditing\Auditable as AuditableTrait;

class Kela extends Model implements Auditable
{
	use HasFactory;
    use AuditableTrait;
    use SoftDeletes;
    /**
     *
     * @var string
     */
    protected $table = 'kelas';
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
        
        'sekolah_id',
        'nama_kelas'
    
    ];
    
    


    public function sekolah()
    {
        return $this->belongsTo(Sekolah::class, 'sekolah_id', 'id');
    }	




    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->sekolah_id) && auth()->check()) {
                $model->sekolah_id = auth()->user()->sekolah_id;
            }
        });
    }

}
