<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PendaftaranKursus>
 */
class PendaftaranKursusFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
	public function definition(): array
	{
		return [
			// pelajar_id and kursus_id will be filled by the Seeder
			'tarikh_pendaftaran' => fake()->dateTimeThisYear(),
			'status' => fake()->randomElement(['Baru', 'Disahkan', 'Ditolak']),
		];
	}
}
