<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Bilik;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Bilik>
 */
class BilikFactory extends Factory
{
    protected $model = Bilik::class;

    public function definition(): array
    {
        return [
            'no_bilik' => fake()->word(),
            'available_slots' => fake()->randomNumber(),
        ];
    }
}
