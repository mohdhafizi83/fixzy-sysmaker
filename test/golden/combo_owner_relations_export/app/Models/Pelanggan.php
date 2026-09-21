<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use OwenIt\Auditing\Contracts\Auditable;
use OwenIt\Auditing\Auditable as AuditableTrait;

class Pelanggan extends Model implements Auditable
{
	use HasFactory;
    use AuditableTrait;
    
    /**
     *
     * @var string
     */
    protected $table = 'pelanggan';
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
        
        'nama_pelanggan',
        'emel'
    
    ];
    
    


    public function tempahans()
    {
        return $this->hasMany(Tempahan::class, 'pelanggan_id', 'id');
    }	




}
