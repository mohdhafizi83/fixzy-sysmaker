<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use OwenIt\Auditing\Contracts\Auditable; //fizisysmaker:filament-auditing
use OwenIt\Auditing\Auditable as AuditableTrait; //fizisysmaker:filament-auditing

class Kursus extends Model implements Auditable //fizisysmaker:filament-auditing
{
	use HasFactory, AuditableTrait; //fizisysmaker:filament-auditing
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'kursus';
    /**
     * Kunci utama untuk model ini.
     *
     * @var string
     */
    protected $primaryKey = 'id_kursus';
    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'nama_kursus',
        'kod_kursus',
        'deskripsi',
        'jam_kredit',
        'prasyarat_kursus_id',
    ];	
// Satu kursus mempunyai banyak pendaftaran
//fizisysmaker:relationship
public function pendaftaranKursus()
{
    return $this->hasMany(PendaftaranKursus::class, 'kursus_id', 'id_kursus');
}

/**
 * Mendapatkan kursus prasyarat untuk kursus ini.
 */
 //fizisysmaker:relationship
public function prasyarat()
{
	// Hubungan ini merujuk kepada model Kursus itu sendiri
	// 'prasyarat_kursus_id' ialah kunci asing (foreign key)
	// 'id_kursus' ialah kunci utama (owner key)
	return $this->belongsTo(Kursus::class, 'prasyarat_kursus_id', 'id_kursus');
}
}
