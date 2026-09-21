<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Aset;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Aset>
 */
class AsetFactory extends Factory
{
    protected $model = Aset::class;

    public function definition(): array
    {
        return [
            'nama_aset' => fake()->name(),
            'created_by' => 1,
            'updated_by' => 1,
        ];
    }
}
