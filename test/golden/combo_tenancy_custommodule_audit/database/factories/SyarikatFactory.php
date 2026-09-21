<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Syarikat;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Syarikat>
 */
class SyarikatFactory extends Factory
{
    protected $model = Syarikat::class;

    public function definition(): array
    {
        return [
            'nama_syarikat' => fake()->name(),
        ];
    }
}
