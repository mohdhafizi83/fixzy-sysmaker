<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\CartaJualan;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\CartaJualan>
 */
class CartaJualanFactory extends Factory
{
    protected $model = CartaJualan::class;

    public function definition(): array
    {
        return [
            'kategori' => fake()->word(),
        ];
    }
}
