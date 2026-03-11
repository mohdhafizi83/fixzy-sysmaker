<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Pelajar>
 */
class PelajarFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
	public function definition(): array
	{
		return [
			'nama_penuh' => fake()->name(),
			'email' => fake()->unique()->safeEmail(),
			'tarikh_daftar' => fake()->dateTimeThisYear(),
			'no_matrik' => fake()->unique()->bothify('??###'),
		];
	}
}
