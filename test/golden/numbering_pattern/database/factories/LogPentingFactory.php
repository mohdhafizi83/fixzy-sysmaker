<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\LogPenting;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\LogPenting>
 */
class LogPentingFactory extends Factory
{
    protected $model = LogPenting::class;

    public function definition(): array
    {
        return [
            'perihal' => fake()->word(),
            'perihal_status' => $this->faker->randomElement(['draft', 'approved']),
            'invoice_no' => fake()->word(),
        ];
    }
}
