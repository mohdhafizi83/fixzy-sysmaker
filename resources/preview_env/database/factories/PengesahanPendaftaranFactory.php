<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PengesahanPendaftaran>
 */
class PengesahanPendaftaranFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
	public function definition(): array
	{
        return [
            // pendaftaran_id and user_id will be filled by the Seeder
            'status_baharu' => fake()->randomElement(['Lulus', 'Gagal', 'Rayuan']),
            'catatan' => fake()->sentence(),
            'tarikh_tindakan' => fake()->dateTimeThisYear(),
        ];
	}
}
