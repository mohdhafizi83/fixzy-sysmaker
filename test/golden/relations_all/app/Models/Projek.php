<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;
use OwenIt\Auditing\Auditable as AuditableTrait;

class Projek extends Model implements Auditable
{
	use HasFactory;
    use AuditableTrait;
    use SoftDeletes;
    /**
     *
     * @var string
     */
    protected $table = 'projek';
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
        
        'nama_projek'
    
    ];
    
    


    public function tugases()
    {
        return $this->hasMany(Tugas::class, 'projek_id', 'id');
    }
    public function nota()
    {
        return $this->hasOne(Nota::class, 'projek_id', 'id');
    }	




}
