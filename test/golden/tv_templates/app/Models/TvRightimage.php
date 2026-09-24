<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\HasAudits;


class TvRightimage extends Model 
{
	use HasFactory;
    use HasAudits;
    use SoftDeletes;
    
    
    /**
     *
     * @var string
     */
    protected $table = 'tv_rightimage';
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
        
        'nama_fakulti',
        'gambar'
    
    ];
    
    

	




}
