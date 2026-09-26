<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Ticket;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Ticket>
 */
class TicketFactory extends Factory
{
    protected $model = Ticket::class;

    public function definition(): array
    {
        return [
            'created_by' => fake()->randomNumber(),
            'updated_by' => fake()->randomNumber(),
            'deleted_by' => fake()->randomNumber(),
            'ticket_no' => fake()->word(),
            'subject' => fake()->word(),
            'requester_name' => fake()->name(),
            'requester_email' => fake()->safeEmail(),
            'priority' => $this->faker->randomElement(['low', 'medium', 'high', 'urgent']),
            'ticket_status' => $this->faker->randomElement(['new', 'open', 'in_progress', 'resolved', 'closed']),
            'assigned_to' => fake()->word(),
            'description' => fake()->paragraph(),
        ];
    }
}
