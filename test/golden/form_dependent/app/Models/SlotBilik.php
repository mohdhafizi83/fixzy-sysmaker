<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\HasAudits;


class SlotBilik extends Model 
{
	use HasFactory;
    use HasAudits;
    use SoftDeletes;
    
    
    /**
     *
     * @var string
     */
    protected $table = 'slot_bilik';
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
        
        'slot_label',
        'bilik_id'
    
    ];
    
    


    public function tempahans()
    {
        return $this->hasMany(Tempahan::class, 'slot', 'id');
    }
    public function bilik()
    {
        return $this->belongsTo(Bilik::class, 'bilik_id', 'id');
    }	




}
