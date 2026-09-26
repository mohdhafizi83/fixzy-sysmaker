<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\TicketReply;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\TicketReply>
 */
class TicketReplyFactory extends Factory
{
    protected $model = TicketReply::class;

    public function definition(): array
    {
        return [
            'created_by' => fake()->randomNumber(),
            'updated_by' => fake()->randomNumber(),
            'deleted_by' => fake()->randomNumber(),
            'ticket_id' => \App\Models\Ticket::inRandomOrder()->value('id'),
            'reply_from' => fake()->word(),
            'is_agent_reply' => fake()->boolean(),
            'message' => fake()->text(),
        ];
    }
}
