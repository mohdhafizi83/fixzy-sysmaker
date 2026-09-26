<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use App\Models\Concerns\HasAudits;


class Activity extends Model 
{
	use HasFactory;
    use HasAudits;
    
    
    
    /**
     *
     * @var string
     */
    protected $table = 'crm_activities';
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
        
        'lead_id',
        'activity_type',
        'activity_date',
        'summary',
        'details'
    
    ];
    
    


    public function lead()
    {
        return $this->belongsTo(Lead::class, 'lead_id', 'id');
    }	




    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
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
    }

}
