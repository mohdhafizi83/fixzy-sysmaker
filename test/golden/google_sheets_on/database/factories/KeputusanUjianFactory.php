<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\KeputusanUjian;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\KeputusanUjian>
 */
class KeputusanUjianFactory extends Factory
{
    protected $model = KeputusanUjian::class;

    public function definition(): array
    {
        return [
            'pelajar_id' => \App\Models\Pelajar::inRandomOrder()->value('id'),
            'test' => fake()->word(),
            'created_by' => fake()->randomNumber(),
            'updated_by' => fake()->randomNumber(),
            'deleted_by' => fake()->randomNumber(),
        ];
    }
}
