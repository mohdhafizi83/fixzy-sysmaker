<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\ItemTempahan;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ItemTempahan>
 */
class ItemTempahanFactory extends Factory
{
    protected $model = ItemTempahan::class;

    public function definition(): array
    {
        return [
            'tempahan_id' => \App\Models\Tempahan::inRandomOrder()->value('id'),
            'produk' => fake()->word(),
            'kuantiti' => fake()->randomNumber(),
            'harga' => fake()->randomFloat(2, 10, 1000),
        ];
    }
}
