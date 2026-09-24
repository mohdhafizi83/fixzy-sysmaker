<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\TvVertical1;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\TvVertical1>
 */
class TvVertical1Factory extends Factory
{
    protected $model = TvVertical1::class;

    public function definition(): array
    {
        return [
            'nama_fakulti' => fake()->name(),
        ];
    }
}
