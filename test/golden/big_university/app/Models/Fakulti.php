<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;
use OwenIt\Auditing\Auditable as AuditableTrait;

class Fakulti extends Model implements Auditable
{
	use HasFactory;
    use AuditableTrait;
    use SoftDeletes;
    /**
     *
     * @var string
     */
    protected $table = 'fakulti';
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
        
        'nama_fakulti'
    
    ];
    
    


    public function pelajars()
    {
        return $this->hasMany(Pelajar::class, 'fakulti_id', 'id');
    }
    public function invoices()
    {
        return $this->hasMany(Invoice::class, 'fakulti_id', 'id');
    }	




}
