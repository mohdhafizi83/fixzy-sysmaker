<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\BookableResource;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\BookableResource>
 */
class BookableResourceFactory extends Factory
{
    protected $model = BookableResource::class;

    public function definition(): array
    {
        return [
            'created_by' => fake()->randomNumber(),
            'updated_by' => fake()->randomNumber(),
            'deleted_by' => fake()->randomNumber(),
            'resource_name' => fake()->name(),
            'resource_code' => fake()->word(),
            'capacity' => fake()->city(),
            'location' => fake()->word(),
            'is_active' => fake()->boolean(),
        ];
    }
}
