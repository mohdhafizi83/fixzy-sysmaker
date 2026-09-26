<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Tugas;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Tugas>
 */
class TugasFactory extends Factory
{
    protected $model = Tugas::class;

    public function definition(): array
    {
        return [
            'projek_id' => \App\Models\Projek::inRandomOrder()->value('id'),
            'tajuk' => fake()->sentence(4),
        ];
    }
}
