<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Kursus;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Kursus>
 */
class KursusFactory extends Factory
{
    protected $model = Kursus::class;

    public function definition(): array
    {
        return [
            'nama_kursus' => fake()->name(),
            'kod_kursus' => fake()->word(),
            'deskripsi' => fake()->paragraph(),
            'jam_kredit' => fake()->randomNumber(),
            'prasyarat_kursus_id' => \App\Models\Kursus::inRandomOrder()->value('id'),
            'lokasi_kelas' => fake()->word(),
            'youtube_intro' => fake()->word(),
        ];
    }
}
