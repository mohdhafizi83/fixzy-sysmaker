<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\HasAudits;


class Projek extends Model 
{
	use HasFactory;
    use HasAudits;
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
