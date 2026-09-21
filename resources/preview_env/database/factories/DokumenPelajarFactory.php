<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\DokumenPelajar>
 */
class DokumenPelajarFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
	public function definition(): array
	{
		return [
			// pelajar_id will be filled in automatically
			'nama_fail' => fake()->sentence(3),
			'path_fail' => fake()->imageUrl(),
		];
	}
}
