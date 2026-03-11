<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ProfilPelajar>
 */
class ProfilPelajarFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
	public function definition(): array
	{
		return [
			// pelajar_id akan diisi secara automatik nanti
			'alamat' => fake()->address(),
			'no_telefon' => fake()->phoneNumber(),
			'tarikh_lahir' => fake()->date(),
		];
	}
}
