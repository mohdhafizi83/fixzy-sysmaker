<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\HasAudits;


class Tempahan extends Model 
{
	use HasFactory;
    use HasAudits;
    use SoftDeletes;
    
    
    /**
     *
     * @var string
     */
    protected $table = 'tempahan';
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
        
        'nama',
        'room_number',
        'slot'
    
    ];
    
    


    public function bilik()
    {
        return $this->belongsTo(Bilik::class, 'room_number', 'id');
    }
    public function slotBilik()
    {
        return $this->belongsTo(SlotBilik::class, 'slot', 'id');
    }	




}
