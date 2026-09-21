<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;
use OwenIt\Auditing\Auditable as AuditableTrait;

class Kontrak extends Model implements Auditable
{
	use HasFactory;
    use AuditableTrait;
    use SoftDeletes;
    /**
     *
     * @var string
     */
    protected $table = 'kontrak';
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
        
        'syarikat_id',
        'no_rujukan',
        'nilai',
        'created_by',
        'updated_by',
        'deleted_by'
    
    ];
    
    


    public function syarikat()
    {
        return $this->belongsTo(Syarikat::class, 'syarikat_id', 'id');
    }	




    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->syarikat_id) && auth()->check()) {
                $model->syarikat_id = auth()->user()->syarikat_id;
            }
            if (empty($model->created_by)) {
                $model->created_by = auth()->id();
            }
            if (empty($model->updated_by)) {
                $model->updated_by = auth()->id();
            }
        });

        static::updating(function ($model) {
            $model->updated_by = auth()->id();
        });

        static::deleting(function ($model) {
            $model->deleted_by = auth()->id();
            $model->saveQuietly(); // Guna saveQuietly elak trigger event updating
        });
    }

}
