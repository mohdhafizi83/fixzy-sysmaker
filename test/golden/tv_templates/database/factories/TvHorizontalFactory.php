<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\TvHorizontal;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\TvHorizontal>
 */
class TvHorizontalFactory extends Factory
{
    protected $model = TvHorizontal::class;

    public function definition(): array
    {
        return [
            'nama_fakulti' => fake()->name(),
        ];
    }
}
