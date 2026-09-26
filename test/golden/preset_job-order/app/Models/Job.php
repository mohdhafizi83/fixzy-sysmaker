<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use App\Models\Concerns\HasAudits;

use App\Models\Concerns\HasNumbering;

class Job extends Model 
{
	use HasFactory;
    use HasAudits;
    
    
    use HasNumbering;

    protected static function numberingConfig(): array
    {
        return ['field' => 'job_no', 'prefix' => 'JOB', 'date_token' => 'YYYYMM', 'width' => 4, 'reset' => 'monthly'];
    }

    
    /**
     *
     * @var string
     */
    protected $table = 'jobs';
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
        
        'job_no',
        'title',
        'customer_name',
        'customer_phone',
        'site_address',
        'scheduled_date',
        'due_date',
        'assigned_technician',
        'job_status',
        'completion_notes'
    
    ];
    
    


    public function jobTasks()
    {
        return $this->hasMany(JobTask::class, 'job_id', 'id');
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
