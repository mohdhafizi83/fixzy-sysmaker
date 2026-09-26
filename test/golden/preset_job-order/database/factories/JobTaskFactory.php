<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\JobTask;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\JobTask>
 */
class JobTaskFactory extends Factory
{
    protected $model = JobTask::class;

    public function definition(): array
    {
        return [
            'created_by' => fake()->randomNumber(),
            'updated_by' => fake()->randomNumber(),
            'deleted_by' => fake()->randomNumber(),
            'job_id' => \App\Models\Job::inRandomOrder()->value('id'),
            'task_name' => fake()->name(),
            'task_order' => fake()->randomNumber(),
            'is_done' => fake()->boolean(),
            'notes' => fake()->text(),
        ];
    }
}
