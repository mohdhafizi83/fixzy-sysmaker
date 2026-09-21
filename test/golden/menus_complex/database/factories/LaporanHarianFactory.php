<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\LaporanHarian;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\LaporanHarian>
 */
class LaporanHarianFactory extends Factory
{
    protected $model = LaporanHarian::class;

    public function definition(): array
    {
        return [
            'tarikh_laporan' => fake()->dateTimeThisYear(),
        ];
    }
}
