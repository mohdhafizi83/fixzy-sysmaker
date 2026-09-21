<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;
use OwenIt\Auditing\Auditable as AuditableTrait;

class Kategori extends Model implements Auditable
{
	use HasFactory;
    use AuditableTrait;
    use SoftDeletes;
    /**
     *
     * @var string
     */
    protected $table = 'kategori';
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
        
        'nama_kategori',
        'parent_kategori_id'
    
    ];
    
    


    public function children()
    {
        return $this->hasMany(Kategori::class, 'parent_kategori_id', 'id');
    }
    public function parent()
    {
        return $this->belongsTo(Kategori::class, 'parent_kategori_id', 'id');
    }	




}
