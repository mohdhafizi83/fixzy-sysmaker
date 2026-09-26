<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use App\Models\Concerns\HasAudits;

use App\Models\Concerns\HasNumbering;

class Booking extends Model 
{
	use HasFactory;
    use HasAudits;
    
    
    use HasNumbering;

    protected static function numberingConfig(): array
    {
        return ['field' => 'booking_ref', 'prefix' => 'BKG', 'date_token' => 'YYYYMMDD', 'width' => 4, 'reset' => 'daily'];
    }

    
    /**
     *
     * @var string
     */
    protected $table = 'bookings';
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
        
        'booking_ref',
        'resource_id',
        'booker_name',
        'booker_email',
        'start_datetime',
        'end_datetime',
        'attendees',
        'notes',
        'booking_status'
    
    ];
    
    


    public function bookableResource()
    {
        return $this->belongsTo(BookableResource::class, 'resource_id', 'id');
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
