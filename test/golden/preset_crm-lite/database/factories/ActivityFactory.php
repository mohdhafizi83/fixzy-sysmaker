<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Activity;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Activity>
 */
class ActivityFactory extends Factory
{
    protected $model = Activity::class;

    public function definition(): array
    {
        return [
            'created_by' => fake()->randomNumber(),
            'updated_by' => fake()->randomNumber(),
            'deleted_by' => fake()->randomNumber(),
            'lead_id' => \App\Models\Lead::inRandomOrder()->value('id'),
            'activity_type' => $this->faker->randomElement(['call', 'meeting', 'email', 'note', 'follow_up']),
            'activity_date' => fake()->dateTimeThisYear(),
            'summary' => fake()->word(),
            'details' => fake()->text(),
        ];
    }
}
