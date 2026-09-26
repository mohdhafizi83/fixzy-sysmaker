<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\HasAudits;


class Bilik extends Model 
{
	use HasFactory;
    use HasAudits;
    use SoftDeletes;
    
    
    /**
     *
     * @var string
     */
    protected $table = 'bilik';
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
        
        'no_bilik',
        'available_slots'
    
    ];
    
    


    public function slotBiliks()
    {
        return $this->hasMany(SlotBilik::class, 'bilik_id', 'id');
    }
    public function tempahans()
    {
        return $this->hasMany(Tempahan::class, 'room_number', 'id');
    }	




}
