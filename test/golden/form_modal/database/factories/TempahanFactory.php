<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Tempahan;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Tempahan>
 */
class TempahanFactory extends Factory
{
    protected $model = Tempahan::class;

    public function definition(): array
    {
        return [
            'nama' => fake()->name(),
            'room_number' => \App\Models\Bilik::inRandomOrder()->value('id'),
            'slot' => \App\Models\SlotBilik::inRandomOrder()->value('id'),
        ];
    }
}
