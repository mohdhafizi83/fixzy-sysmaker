<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Kontrak;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Kontrak>
 */
class KontrakFactory extends Factory
{
    protected $model = Kontrak::class;

    public function definition(): array
    {
        return [
            'syarikat_id' => \App\Models\Syarikat::inRandomOrder()->value('id'),
            'no_rujukan' => fake()->word(),
            'nilai' => fake()->randomFloat(2, 10, 1000),
            'created_by' => fake()->randomNumber(),
            'updated_by' => fake()->randomNumber(),
            'deleted_by' => fake()->randomNumber(),
        ];
    }
}
