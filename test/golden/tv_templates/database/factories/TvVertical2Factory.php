<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\TvVertical2;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\TvVertical2>
 */
class TvVertical2Factory extends Factory
{
    protected $model = TvVertical2::class;

    public function definition(): array
    {
        return [
            'nama_fakulti' => fake()->name(),
        ];
    }
}
