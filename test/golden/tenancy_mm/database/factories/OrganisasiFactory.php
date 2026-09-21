<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Organisasi;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Organisasi>
 */
class OrganisasiFactory extends Factory
{
    protected $model = Organisasi::class;

    public function definition(): array
    {
        return [
            'nama_organisasi' => fake()->name(),
        ];
    }
}
