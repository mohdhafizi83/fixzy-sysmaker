<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\HasAudits;
use App\Models\Concerns\BelongsToTenant;

class Kela extends Model 
{
	use HasFactory;
    use HasAudits;
    use SoftDeletes;
    use BelongsToTenant;
    protected $tenantForeignKey = 'sekolah_id';
    /**
     *
     * @var string
     */
    protected $table = 'kelas';
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
        
        'sekolah_id',
        'nama_kelas'
    
    ];
    
    


    public function sekolah()
    {
        return $this->belongsTo(Sekolah::class, 'sekolah_id', 'id');
    }	




}
