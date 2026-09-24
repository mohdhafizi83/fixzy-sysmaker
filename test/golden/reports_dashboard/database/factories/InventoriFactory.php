<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Inventori;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Inventori>
 */
class InventoriFactory extends Factory
{
    protected $model = Inventori::class;

    public function definition(): array
    {
        return [
            'item_name' => fake()->name(),
            'kuantiti' => fake()->randomNumber(),
            'harga_seunit' => fake()->randomFloat(2, 10, 1000),
        ];
    }
}
