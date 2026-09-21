<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\JanaBil;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\JanaBil>
 */
class JanaBilFactory extends Factory
{
    protected $model = JanaBil::class;

    public function definition(): array
    {
        return [
            'bil_1' => fake()->randomNumber(),
            'bil_2' => fake()->randomNumber(),
            'jumlah' => fake()->randomNumber(),
        ];
    }
}
