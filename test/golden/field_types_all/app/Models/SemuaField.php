<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;
use OwenIt\Auditing\Auditable as AuditableTrait;

class SemuaField extends Model implements Auditable
{
	use HasFactory;
    use AuditableTrait;
    use SoftDeletes;
    /**
     *
     * @var string
     */
    protected $table = 'semua_field';
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
        
        'teks_biasa',
        'emel',
        'katalaluan',
        'telefon',
        'pautan',
        'berkas_topeng',
        'umur',
        'gaji',
        'kod_zero',
        'unik_kod',
        'cerita',
        'rich_teks',
        'aktif',
        'status',
        'tag_multi',
        'tarikh_masa',
        'emel_berulang',
        'butiran',
        'helper_cara',
        'auto_off'
    
    ];
    

    protected function casts(): array
    {
        return [
            'aktif' => 'boolean',
            'emel_berulang' => 'array',
            'butiran' => 'array',
        ];
    }
    

	




}
