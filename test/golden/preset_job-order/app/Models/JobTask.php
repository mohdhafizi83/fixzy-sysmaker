<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use App\Models\Concerns\HasAudits;


class JobTask extends Model 
{
	use HasFactory;
    use HasAudits;
    
    
    
    /**
     *
     * @var string
     */
    protected $table = 'job_tasks';
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
        
        'job_id',
        'task_name',
        'task_order',
        'is_done',
        'notes'
    
    ];
    
    


    public function job()
    {
        return $this->belongsTo(Job::class, 'job_id', 'id');
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
