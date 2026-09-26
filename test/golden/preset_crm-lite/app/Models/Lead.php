<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use App\Models\Concerns\HasAudits;


class Lead extends Model 
{
	use HasFactory;
    use HasAudits;
    
    
    
    /**
     *
     * @var string
     */
    protected $table = 'crm_leads';
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
        
        'lead_name',
        'contact_id',
        'source',
        'pipeline_stage',
        'estimated_value',
        'expected_close_date',
        'owner_name'
    
    ];
    
    


    public function activities()
    {
        return $this->hasMany(Activity::class, 'lead_id', 'id');
    }
    public function contact()
    {
        return $this->belongsTo(Contact::class, 'contact_id', 'id');
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
