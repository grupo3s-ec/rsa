<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\HazardType>
 */
class HazardTypeFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'condition' => fake()->randomElement(['fisica', 'natural', 'entorno_riesgo_publico']),
            'name' => fake()->unique()->words(2, true),
            'risks' => fake()->sentence(6),
            'severity' => fake()->randomElement(['low', 'medium', 'high']),
        ];
    }
}
