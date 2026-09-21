<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;
use OwenIt\Auditing\Auditable as AuditableTrait;

class Tugas extends Model implements Auditable
{
	use HasFactory;
    use AuditableTrait;
    use SoftDeletes;
    /**
     *
     * @var string
     */
    protected $table = 'tugas';
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
        
        'projek_id',
        'tajuk'
    
    ];
    
    


    public function projek()
    {
        return $this->belongsTo(Projek::class, 'projek_id', 'id');
    }	




}
