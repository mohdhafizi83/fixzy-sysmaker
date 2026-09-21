<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\LaporanBulanan;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\LaporanBulanan>
 */
class LaporanBulananFactory extends Factory
{
    protected $model = LaporanBulanan::class;

    public function definition(): array
    {
        return [
            'bulan' => fake()->word(),
        ];
    }
}
