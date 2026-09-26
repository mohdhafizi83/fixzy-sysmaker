<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use App\Models\Concerns\HasAudits;


class Contact extends Model 
{
	use HasFactory;
    use HasAudits;
    
    
    
    /**
     *
     * @var string
     */
    protected $table = 'crm_contacts';
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
        
        'full_name',
        'company',
        'email',
        'phone',
        'job_title',
        'notes'
    
    ];
    
    


    public function leads()
    {
        return $this->hasMany(Lead::class, 'contact_id', 'id');
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
