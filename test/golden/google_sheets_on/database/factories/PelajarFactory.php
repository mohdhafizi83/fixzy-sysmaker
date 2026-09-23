<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Pelajar;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Pelajar>
 */
class PelajarFactory extends Factory
{
    protected $model = Pelajar::class;

    public function definition(): array
    {
        return [
            'fakulti_id' => \App\Models\Fakulti::inRandomOrder()->value('id'),
            'nama_penuh' => fake()->name(),
            'no_matrik' => fake()->unique()->bothify('??#####'),
            'email' => [$this->faker->unique()->safeEmail(), $this->faker->unique()->safeEmail(), $this->faker->unique()->safeEmail()],
            'tarikh_daftar' => fake()->date(),
            'gambar_profil' => fake()->word(),
            'surat_tawaran' => fake()->word(),
        ];
    }
}
