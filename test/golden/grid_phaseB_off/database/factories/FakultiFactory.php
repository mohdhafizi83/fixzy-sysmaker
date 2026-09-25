<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Fakulti;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Fakulti>
 */
class FakultiFactory extends Factory
{
    protected $model = Fakulti::class;

    public function definition(): array
    {
        return [
            'nama_fakulti' => fake()->name(),
            'is_aktif' => fake()->boolean(),
        ];
    }
}
