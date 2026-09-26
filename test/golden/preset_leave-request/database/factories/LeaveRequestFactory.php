<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\LeaveRequest;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\LeaveRequest>
 */
class LeaveRequestFactory extends Factory
{
    protected $model = LeaveRequest::class;

    public function definition(): array
    {
        return [
            'created_by' => fake()->randomNumber(),
            'updated_by' => fake()->randomNumber(),
            'deleted_by' => fake()->randomNumber(),
            'employee_name' => fake()->name(),
            'employee_email' => fake()->safeEmail(),
            'leave_type_id' => \App\Models\LeaveType::inRandomOrder()->value('id'),
            'start_date' => fake()->date(),
            'end_date' => fake()->date(),
            'days_requested' => fake()->randomFloat(2, 10, 1000),
            'reason' => fake()->text(),
            'approval_status' => $this->faker->randomElement(['draft', 'pending', 'manager_review', 'approved', 'rejected']),
        ];
    }
}
