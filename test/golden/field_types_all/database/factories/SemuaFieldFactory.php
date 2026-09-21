<?php
namespace Database\Factories;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\SemuaField;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\SemuaField>
 */
class SemuaFieldFactory extends Factory
{
    protected $model = SemuaField::class;

    public function definition(): array
    {
        return [
            'teks_biasa' => fake()->word(),
            'emel' => fake()->word(),
            'katalaluan' => fake()->word(),
            'telefon' => fake()->phoneNumber(),
            'pautan' => fake()->word(),
            'berkas_topeng' => fake()->word(),
            'umur' => fake()->randomNumber(),
            'gaji' => fake()->randomFloat(2, 10, 1000),
            'kod_zero' => fake()->randomNumber(),
            'unik_kod' => fake()->word(),
            'cerita' => fake()->text(),
            'rich_teks' => fake()->text(),
            'aktif' => fake()->boolean(),
            'status' => $this->faker->randomElement(['aktif', 'tidak aktif', 'senarai hitam']),
            'tag_multi' => $this->faker->randomElement(['penting', 'segera', 'biasa']),
            'tarikh_masa' => fake()->dateTimeThisYear(),
            'emel_berulang' => [$this->faker->unique()->safeEmail(), $this->faker->unique()->safeEmail(), $this->faker->unique()->safeEmail()],
            'butiran' => [['butiran_1' => $this->faker->word(), 'butiran_2' => $this->faker->word(), 'butiran_3' => $this->faker->url()], ['butiran_1' => $this->faker->word(), 'butiran_2' => $this->faker->word(), 'butiran_3' => $this->faker->url()]],
            'helper_cara' => fake()->word(),
            'auto_off' => fake()->word(),
        ];
    }
}
