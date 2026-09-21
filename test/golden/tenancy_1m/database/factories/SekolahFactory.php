<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Sekolah;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Sekolah>
 */
class SekolahFactory extends Factory
{
    protected $model = Sekolah::class;

    public function definition(): array
    {
        return [
            'nama_sekolah' => fake()->name(),
        ];
    }
}
