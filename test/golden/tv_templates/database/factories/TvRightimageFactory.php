<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\TvRightimage;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\TvRightimage>
 */
class TvRightimageFactory extends Factory
{
    protected $model = TvRightimage::class;

    public function definition(): array
    {
        return [
            'nama_fakulti' => fake()->name(),
            'gambar' => fake()->word(),
        ];
    }
}
