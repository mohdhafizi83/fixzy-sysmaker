<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\TvCard;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\TvCard>
 */
class TvCardFactory extends Factory
{
    protected $model = TvCard::class;

    public function definition(): array
    {
        return [
            'nama_fakulti' => fake()->name(),
            'gambar' => fake()->word(),
        ];
    }
}
