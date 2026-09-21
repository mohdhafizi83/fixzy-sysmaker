<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use App\Models\Concerns\HasAudits;


class ItemTempahan extends Model 
{
	use HasFactory;
    use HasAudits;
    
    
    
    /**
     *
     * @var string
     */
    protected $table = 'item_tempahan';
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
        
        'tempahan_id',
        'produk',
        'kuantiti',
        'harga'
    
    ];
    
    


    public function tempahan()
    {
        return $this->belongsTo(Tempahan::class, 'tempahan_id', 'id');
    }	




}
