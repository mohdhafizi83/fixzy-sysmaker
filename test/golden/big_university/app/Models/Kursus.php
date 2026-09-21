<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\HasAudits;


class Kursus extends Model 
{
	use HasFactory;
    use HasAudits;
    use SoftDeletes;
    
    
    /**
     *
     * @var string
     */
    protected $table = 'kursus';
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
        
        'nama_kursus',
        'kod_kursus',
        'deskripsi',
        'jam_kredit',
        'prasyarat_kursus_id',
        'lokasi_kelas',
        'youtube_intro'
    
    ];
    
    


    public function children()
    {
        return $this->hasMany(Kursus::class, 'prasyarat_kursus_id', 'id');
    }
    public function pendaftaranKursuses()
    {
        return $this->hasMany(PendaftaranKursus::class, 'kursus_id', 'id');
    }
    public function parent()
    {
        return $this->belongsTo(Kursus::class, 'prasyarat_kursus_id', 'id');
    }	




    public function getCleanYoutubeUrl(string $fieldName): string
    {
        $url = $this->{$fieldName};
        if (blank($url)) {
            return '';
        }

        preg_match('/(?:v=|\/v\/|watch\?v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/', $url, $matches);

        if (isset($matches[1])) {
            return 'https://www.youtube.com/embed/' . $matches[1];
        }

        return $url;
    }

}
