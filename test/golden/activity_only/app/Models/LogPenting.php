<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;



class LogPenting extends Model 
{
	use HasFactory;
    
    use SoftDeletes;
    
    
    /**
     *
     * @var string
     */
    protected $table = 'log_penting';
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
        
        'perihal'
    
    ];
    
    

	




}
