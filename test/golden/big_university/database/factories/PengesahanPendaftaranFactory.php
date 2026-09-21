<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\PengesahanPendaftaran;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PengesahanPendaftaran>
 */
class PengesahanPendaftaranFactory extends Factory
{
    protected $model = PengesahanPendaftaran::class;

    public function definition(): array
    {
        return [
            'pendaftaran_id' => \App\Models\PendaftaranKursus::inRandomOrder()->value('id'),
            'user_id' => \App\Models\User::inRandomOrder()->value('id'),
            'status' => fake()->word(),
            'catatan' => fake()->text(),
            'tarikh_tindakan' => fake()->dateTimeThisYear(),
        ];
    }
}
