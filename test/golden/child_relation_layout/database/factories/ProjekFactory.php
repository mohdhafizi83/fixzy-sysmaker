<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Projek;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Projek>
 */
class ProjekFactory extends Factory
{
    protected $model = Projek::class;

    public function definition(): array
    {
        return [
            'nama_projek' => fake()->name(),
        ];
    }
}
