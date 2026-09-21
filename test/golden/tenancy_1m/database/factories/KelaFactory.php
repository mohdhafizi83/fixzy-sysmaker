<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Kela;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Kela>
 */
class KelaFactory extends Factory
{
    protected $model = Kela::class;

    public function definition(): array
    {
        return [
            'sekolah_id' => \App\Models\Sekolah::inRandomOrder()->value('id'),
            'nama_kelas' => fake()->name(),
        ];
    }
}
