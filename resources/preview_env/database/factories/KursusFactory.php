<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Kursus>
 */
class KursusFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
	public function definition(): array
	{
		return [
			'nama_kursus' => fake()->randomElement(['Sains Komputer', 'Kejuruteraan Perisian', 'Pengurusan Perniagaan', 'Seni Kulinari', 'Reka Bentuk Grafik']),
			'kod_kursus' => fake()->unique()->bothify('??###'), // cth: CS101
			'deskripsi' => fake()->paragraph(),
		];
	}
}
